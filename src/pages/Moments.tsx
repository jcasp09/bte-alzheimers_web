import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { NodeMouseHandler } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import styles from './Graph.module.css'
import momentsStyles from './Moments.module.css'
import { MomentsFlow } from '../components/MomentsFlow'
import { DOCK_NODE_DND_TYPE } from '../components/flowConstants'
import { MomentEditorCard } from '../components/MomentEditorCard'
import { AddMomentModal } from '../components/modals/AddMomentModal'
import { SidePanel } from '../components/ui/SidePanel'
import { getNodes } from '../services/graph'
import type { NodeDoc } from '../types/graph'
import { getMoments, parseOccurredOn, type MomentDoc } from '../firebase/moments'
import { buildMomentFlowNodes, type DrillLevel, type ViewMode } from '../moments/graphLayout'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function getInitialsForAvatar(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function Moments() {
  const { user } = useAuth()
  const [moments, setMoments] = useState<MomentDoc[]>([])
  const [contextNodes, setContextNodes] = useState<NodeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [level, setLevel] = useState<DrillLevel>('years')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [overlay, setOverlay] = useState<{ y: number; m: number; d: number } | null>(null)
  const [addMomentOpen, setAddMomentOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('chronological')

  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    setLoadError(null)
    try {
      const [ms, nodes] = await Promise.all([getMoments(user.uid), getNodes(user.uid, 'context')])
      setMoments(ms)
      setContextNodes(nodes)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load moments')
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) {
      setMoments([])
      setContextNodes([])
      setLoading(false)
      return
    }
    void load()
  }, [user?.uid, load])

  const people = useMemo(
    () => contextNodes.filter((n) => n.type === 'person'),
    [contextNodes],
  )

  const flowNodes = useMemo(
    () => buildMomentFlowNodes(viewMode, level, moments, selectedYear, selectedMonth, MONTH_NAMES),
    [viewMode, level, moments, selectedYear, selectedMonth],
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const data = node.data as {
        kind: 'year' | 'month' | 'day'
        year: number
        month?: number
        day?: number
      }
      if (data.kind === 'year') {
        setLevel('months')
        setSelectedYear(data.year)
        setSelectedMonth(null)
        return
      }
      if (data.kind === 'month' && data.month != null) {
        setLevel('days')
        setSelectedYear(data.year)
        setSelectedMonth(data.month)
        return
      }
      if (data.kind === 'day' && data.month != null && data.day != null) {
        setOverlay({ y: data.year, m: data.month, d: data.day })
      }
    },
    [],
  )

  const handleBack = () => {
    if (overlay) {
      closeOverlay()
      return
    }
    if (level === 'days') {
      setLevel('months')
      return
    }
    if (level === 'months') {
      setLevel('years')
      setSelectedYear(null)
      setSelectedMonth(null)
    }
  }

  const closeOverlay = () => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
    setOverlay(null)
  }

  const overlayMoments = useMemo(() => {
    if (!overlay) return []
    return moments
      .filter((m) => {
        const p = parseOccurredOn(m.occurredOn)
        return p && p.y === overlay.y && p.m === overlay.m && p.d === overlay.d
      })
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis() ?? 0
        const tb = b.createdAt?.toMillis() ?? 0
        return tb - ta
      })
  }, [moments, overlay])

  const primaryOverlayMoment = overlayMoments[0] ?? null

  const showBack = level !== 'years' || overlay != null

  const closeAddMoment = () => setAddMomentOpen(false)

  const handleMomentDragStart = (e: ReactDragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DOCK_NODE_DND_TYPE, 'moment')
    e.dataTransfer.effectAllowed = 'copy'
  }

  const toggleAddMoment = () => {
    setAddMomentOpen((o) => {
      const next = !o
      if (next) setOverlay(null)
      return next
    })
  }

  const isSidePanelOpen = addMomentOpen || overlay != null

  if (!user) {
    return (
      <section className={styles.statusFrame}>
        <h1>Moments</h1>
        <p>Sign in to browse your moments.</p>
        <Link to="/">Go to Home</Link>
      </section>
    )
  }

  if (loading) {
    return (
      <section className={styles.statusFrame}>
        <h1>Moments</h1>
        <p>Loading your moments…</p>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className={styles.statusFrame}>
        <h1>Moments</h1>
        <p className="text-error">{loadError}</p>
      </section>
    )
  }

  const overlayDateLabel = overlay
    ? `${MONTH_NAMES[overlay.m - 1]} ${overlay.d}, ${overlay.y}`
    : ''

  return (
    <section className={styles.fullBleedRoot} aria-label="Moments graph">
      <h1 className="sr-only">Moments</h1>

      <div className={clsx(styles.canvasContainer, isSidePanelOpen && styles.canvasContainerPanelOpen)}>
        <div className={styles.flowFill}>
          <MomentsFlow
            key={`${viewMode}-${level}-${selectedYear}-${selectedMonth}`}
            nodes={flowNodes}
            onNodeClick={onNodeClick}
            onMomentDrop={() => setAddMomentOpen(true)}
          />
        </div>

        <div className={momentsStyles.topChrome}>
          {showBack ? (
            <button
              type="button"
              className={momentsStyles.chipButton}
              onClick={handleBack}
              aria-label="Go back to previous level"
            >
              ← Back
            </button>
          ) : null}

          <div className={momentsStyles.sortGroup} role="group" aria-label="Sort moments">
            <span className={momentsStyles.sortLabel}>Sort by</span>
            <button
              type="button"
              className={clsx(momentsStyles.chipButton, viewMode === 'chronological' && momentsStyles.chipButtonActive)}
              onClick={() => setViewMode('chronological')}
              aria-pressed={viewMode === 'chronological'}
            >
              Date
            </button>
            <button
              type="button"
              className={clsx(momentsStyles.chipButton, viewMode === 'impactful' && momentsStyles.chipButtonActive)}
              onClick={() => setViewMode('impactful')}
              aria-pressed={viewMode === 'impactful'}
            >
              Content
            </button>
          </div>
        </div>

        <div className={styles.dock} role="toolbar" aria-label="Moments actions">
          <button
            type="button"
            draggable
            onDragStart={handleMomentDragStart}
            onClick={toggleAddMoment}
            aria-label="Add a moment. Click to open the form, or drag onto the canvas."
            className={clsx(styles.dockItem, styles.dockItemDraggable, addMomentOpen && styles.dockItemActive)}
          >
            <span className={clsx(styles.dockIcon, styles.dockIconMoment)} aria-hidden="true">+</span>
            <span className={styles.dockLabel}>Moment</span>
          </button>
        </div>

        {addMomentOpen ? (
          <AddMomentModal
            userId={user.uid}
            people={people.map((n) => ({ id: n.id, name: n.name }))}
            onClose={closeAddMoment}
            onCreated={load}
          />
        ) : null}

        {overlay ? (
          <SidePanel
            title={overlayDateLabel}
            onClose={closeOverlay}
            accent="moment"
            hero={{ avatarLabel: getInitialsForAvatar(primaryOverlayMoment?.title ?? '') }}
          >
            <p className={momentsStyles.overlaySubtitle}>
              One moment per day — view, edit, or delete below.
              {overlayMoments.length > 1
                ? ' (Multiple records found for this date; showing the most recent.)'
                : null}
            </p>

            {!primaryOverlayMoment ? (
              <p className={momentsStyles.emptyDayMessage}>No moment on this day.</p>
            ) : (
              <MomentEditorCard
                uid={user.uid}
                moment={primaryOverlayMoment}
                people={people}
                onRemoved={(id) => {
                  setMoments((prev) => prev.filter((x) => x.id !== id))
                  setOverlay(null)
                }}
                onUpdated={(updated) => {
                  setMoments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                }}
              />
            )}
          </SidePanel>
        ) : null}
      </div>
    </section>
  )
}

export default Moments
