import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { NodeMouseHandler } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import styles from './Graph.module.css'
import momentsStyles from './Moments.module.css'
import { MomentsFlow } from '../components/MomentsFlow'
import { MomentEditorCard } from '../components/MomentEditorCard'
import { AddMomentModal } from '../components/modals/AddMomentModal'
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
    window.setTimeout(() => setOverlay(null), 550)
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

  const toggleAddMoment = () => {
    setAddMomentOpen((o) => !o)
  }

  if (!user) {
    return (
      <section>
        <h1 className={styles.pageTitle}>Moments</h1>
        <p>Sign in to browse your moments.</p>
        <Link to="/">Go to Home</Link>
      </section>
    )
  }

  if (loading) {
    return (
      <section>
        <h1 className={styles.pageTitle}>Moments</h1>
        <p>Loading your moments…</p>
      </section>
    )
  }

  if (loadError) {
    return (
      <section>
        <h1 className={styles.pageTitle}>Moments</h1>
        <p className="text-error">{loadError}</p>
      </section>
    )
  }

  return (
    <section style={{ position: 'relative' }}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Moments</h1>

        <div className={styles.toolbar}>
          {showBack ? (
            <button type="button" className={styles.toolbarButton} onClick={handleBack}>
              ← Back
            </button>
          ) : null}
          <button
            type="button"
            className={clsx(styles.toolbarButton, addMomentOpen && styles.toolbarButtonActive)}
            onClick={toggleAddMoment}
          >
            Add moment
          </button>
        </div>
      </div>

      <div className={momentsStyles.sortRow}>
        <span className={momentsStyles.sortLabel}>Sort By</span>
        <div className={momentsStyles.sortButtons}>
          <button
            type="button"
            className={clsx(styles.toolbarButton, viewMode === 'chronological' && styles.toolbarButtonActive)}
            onClick={() => setViewMode('chronological')}
          >
            Date
          </button>
          <button
            type="button"
            className={clsx(styles.toolbarButton, viewMode === 'impactful' && styles.toolbarButtonActive)}
            onClick={() => setViewMode('impactful')}
          >
            Content
          </button>
        </div>
      </div>

      {addMomentOpen ? (
        <AddMomentModal
          userId={user.uid}
          people={people.map((n) => ({ id: n.id, name: n.name }))}
          onClose={closeAddMoment}
          onCreated={load}
        />
      ) : null}

      <div className={styles.flowContainer}>
        <MomentsFlow
          key={`${viewMode}-${level}-${selectedYear}-${selectedMonth}-${flowNodes.length}`}
          nodes={flowNodes}
          onNodeClick={onNodeClick}
        />
      </div>

      {overlay ? (
        <div
          role="presentation"
          className={momentsStyles.overlayBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeOverlay()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className={momentsStyles.overlayDialog}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h2 className={momentsStyles.overlayTitle}>
                  {MONTH_NAMES[overlay.m - 1]} {overlay.d}, {overlay.y}
                </h2>
                <p className={momentsStyles.overlayMeta}>
                  One moment per day — view, edit, or delete below.
                  {overlayMoments.length > 1
                    ? ' (Multiple records found for this date; showing the most recent.)'
                    : null}
                </p>
              </div>
              <button type="button" className={momentsStyles.closeButton} onClick={closeOverlay}>
                Close
              </button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              {!primaryOverlayMoment ? (
                <p style={{ color: '#6b7280', fontSize: 14 }}>No moment on this day.</p>
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
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Moments
