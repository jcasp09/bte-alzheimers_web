import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import type { MomentDoc } from '../firebase/moments'
import { getMomentMillis, type MemoryBrushRange } from '../moments/memoryLayer'
import styles from './MemoryTimeline.module.css'

type DatedMoment = { moment: MomentDoc; date: number }

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

/** Below this fraction of the track width, a "drag" is treated as a click used to clear the brush. */
const CLICK_VS_DRAG_THRESHOLD = 0.005

type Props = {
  moments: MomentDoc[]
  onMomentClick: (momentId: string) => void
  selectedMomentId?: string | null
  highlightedMomentIds?: ReadonlySet<string>
  brushRange?: MemoryBrushRange | null
  onBrushChange?: (range: MemoryBrushRange | null) => void
  trailingActions?: ReactNode
}

/** Read-only horizontal timeline that lays out moments by date. */
export function MemoryTimeline({
  moments,
  onMomentClick,
  selectedMomentId,
  highlightedMomentIds,
  brushRange,
  onBrushChange,
  trailingActions,
}: Props) {
  const hasSelection = selectedMomentId != null || (highlightedMomentIds != null && highlightedMomentIds.size > 0)

  const trackRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ startFrac: number; pointerId: number } | null>(null)

  const today = useMemo(() => {
    const now = new Date()
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  }, [])

  const { dated, oldest, newest } = useMemo(() => {
    const datedList: DatedMoment[] = []
    for (const m of moments) {
      const date = getMomentMillis(m)
      if (date != null) datedList.push({ moment: m, date })
    }
    datedList.sort((a, b) => a.date - b.date)

    if (datedList.length === 0) {
      return { dated: datedList, oldest: today - YEAR_MS, newest: today }
    }

    const minDate = datedList[0].date
    const maxDate = Math.max(datedList[datedList.length - 1].date, today)
    const pad = Math.max((maxDate - minDate) * 0.05, YEAR_MS * 0.05)
    return {
      dated: datedList,
      oldest: minDate - pad,
      newest: maxDate + pad,
    }
  }, [moments, today])

  const range = Math.max(newest - oldest, 1)

  /** Choose a sensible year-step based on the total span so labels do not
   *  overlap. Aims for roughly 6–10 visible ticks regardless of range. */
  function yearStep(spanYears: number): number {
    if (spanYears <= 6) return 1
    if (spanYears <= 15) return 2
    if (spanYears <= 30) return 5
    if (spanYears <= 80) return 10
    return 20
  }

  const yearTicks = useMemo(() => {
    const startYear = new Date(oldest).getUTCFullYear()
    const endYear = new Date(newest).getUTCFullYear()
    const step = yearStep(endYear - startYear)
    const firstTick = Math.floor(startYear / step) * step
    const ticks: { year: number; frac: number }[] = []
    for (let y = firstTick; y <= endYear; y += step) {
      const ms = Date.UTC(y, 0, 1)
      if (ms < oldest || ms > newest) continue
      ticks.push({ year: y, frac: (ms - oldest) / range })
    }
    return ticks
  }, [oldest, newest, range])

  const todayFrac = (today - oldest) / range
  const todayInRange = todayFrac >= 0 && todayFrac <= 1

  const brushFracs = useMemo(() => {
    if (!brushRange) return null
    const startFrac = Math.max(0, Math.min(1, (brushRange.start - oldest) / range))
    const endFrac = Math.max(0, Math.min(1, (brushRange.end - oldest) / range))
    return { startFrac: Math.min(startFrac, endFrac), endFrac: Math.max(startFrac, endFrac) }
  }, [brushRange, oldest, range])

  const fracForClientX = useCallback((clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!onBrushChange) return
    // Only start a brush when the gesture begins on the track itself
    if (e.target !== e.currentTarget) return
    if (e.button !== 0) return
    const track = trackRef.current
    if (!track) return
    const frac = fracForClientX(e.clientX)
    dragStateRef.current = { startFrac: frac, pointerId: e.pointerId }
    try { track.setPointerCapture(e.pointerId) } catch { /* unsupported, no-op */ }
    // Show a zero-width brush at the start position so the user gets feedback
    // immediately even before they move.
    const ms = oldest + frac * range
    onBrushChange({ start: ms, end: ms })
  }, [onBrushChange, fracForClientX, oldest, range])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!onBrushChange) return
    const drag = dragStateRef.current
    if (!drag) return
    const frac = fracForClientX(e.clientX)
    const lo = Math.min(drag.startFrac, frac)
    const hi = Math.max(drag.startFrac, frac)
    onBrushChange({ start: oldest + lo * range, end: oldest + hi * range })
  }, [onBrushChange, fracForClientX, oldest, range])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!onBrushChange) return
    const drag = dragStateRef.current
    if (!drag) return
    const track = trackRef.current
    try { track?.releasePointerCapture(e.pointerId) } catch { /* unsupported */ }
    const frac = fracForClientX(e.clientX)
    const dist = Math.abs(frac - drag.startFrac)
    dragStateRef.current = null
    if (dist < CLICK_VS_DRAG_THRESHOLD) {
      // Click without meaningful drag = clear the brush.
      onBrushChange(null)
    }
  }, [onBrushChange, fracForClientX])

  return (
    <div className={styles.timeline} role="region" aria-label="Memory timeline">
      <div className={styles.timelineMain}>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {brushFracs ? (
          <div
            className={styles.brushOverlay}
            style={{
              left: `${brushFracs.startFrac * 100}%`,
              width: `${(brushFracs.endFrac - brushFracs.startFrac) * 100}%`,
            }}
            aria-hidden="true"
          />
        ) : null}
        {yearTicks.map(({ year, frac }) => (
          <div
            key={`year-${year}`}
            className={styles.yearTick}
            style={{ left: `${frac * 100}%` }}
            aria-hidden="true"
          >
            <span className={styles.yearLabel}>{year}</span>
          </div>
        ))}

        {dated.map(({ moment, date }) => {
          const frac = (date - oldest) / range
          const label = moment.title.trim().length > 0 ? moment.title : moment.occurredOn
          const isSelected = selectedMomentId === moment.id
          const isHighlighted = !isSelected && (highlightedMomentIds?.has(moment.id) ?? false)
          const inBrush = brushRange == null || (date >= brushRange.start && date <= brushRange.end)
          // Dim if outside the active brush, or if a selection is active and this
          // moment is neither the selected one nor part of the highlighted set.
          const isDimmed = !inBrush || (hasSelection && !isSelected && !isHighlighted && inBrush)
          return (
            <button
              key={moment.id}
              type="button"
              className={clsx(
                styles.dot,
                isSelected && styles.dotSelected,
                isHighlighted && styles.dotHighlighted,
                isDimmed && styles.dotDimmed,
              )}
              style={{ left: `${frac * 100}%` }}
              onClick={() => onMomentClick(moment.id)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`Focus moment: ${label}`}
              aria-pressed={isSelected}
              title={label}
            />
          )
        })}

        {todayInRange ? (
          <div
            className={styles.today}
            style={{ left: `${todayFrac * 100}%` }}
            aria-hidden="true"
          >
            <span className={styles.todayLabel}>Today</span>
          </div>
        ) : null}
      </div>

      {dated.length === 0 ? (
        <p className={styles.empty}>No memories yet.</p>
      ) : null}
      </div>
      {trailingActions ? (
        <>
          <div className={styles.trailingDivider} aria-hidden="true" />
          <div className={styles.trailingActions}>{trailingActions}</div>
        </>
      ) : null}
    </div>
  )
}
