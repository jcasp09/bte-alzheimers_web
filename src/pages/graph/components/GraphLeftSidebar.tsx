import { useEffect, useRef, type Ref } from 'react'
import clsx from 'clsx'
import { RINGS, type RingTier } from '../../../graph/model/rings'
import { writeSidebarCollapsedPref } from './graphLeftSidebarPrefs'
import styles from './GraphLeftSidebar.module.css'

type Props = {
  collapsed: boolean
  setCollapsed: (next: boolean) => void
  visibleRings: ReadonlySet<RingTier>
  setVisibleRings: (updater: (prev: Set<RingTier>) => Set<RingTier>) => void
  showAllEdges: boolean
  setShowAllEdges: (next: boolean) => void
  memoryLensOn: boolean
  setMemoryLensOn: (next: boolean) => void
  minimapHostRef: Ref<HTMLDivElement>
}

export function GraphLeftSidebar({
  collapsed,
  setCollapsed,
  visibleRings,
  setVisibleRings,
  showAllEdges,
  setShowAllEdges,
  memoryLensOn,
  setMemoryLensOn,
  minimapHostRef,
}: Props) {
  // Mirror collapsed state to localStorage so it survives reloads.
  const lastWrittenRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (lastWrittenRef.current === collapsed) return
    lastWrittenRef.current = collapsed
    writeSidebarCollapsedPref(collapsed)
  }, [collapsed])

  const hasRingsOff = RINGS.some((r) => !visibleRings.has(r.tier))
  const toggleRing = (tier: RingTier) =>
    setVisibleRings((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })

  if (collapsed) {
    return (
      <aside className={clsx(styles.rail, styles.railCollapsed)} aria-label="Graph tools (collapsed)">
        <div className={styles.frame}>
          <div className={styles.collapsedStack}>
            <button
              type="button"
              className={styles.collapsedItem}
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              aria-expanded={false}
            >
              <ChevronRightIcon />
            </button>
            <div className={styles.collapsedDivider} aria-hidden="true" />
            <button
              type="button"
              className={styles.collapsedItem}
              onClick={() => setCollapsed(false)}
              aria-label={hasRingsOff ? 'Rings (some hidden) — expand to adjust' : 'Rings — expand to adjust'}
              title="Rings"
            >
              <RingsIcon />
              {hasRingsOff ? <span className={styles.collapsedItemBadge} aria-hidden="true" /> : null}
            </button>
            <button
              type="button"
              className={styles.collapsedItem}
              onClick={() => setCollapsed(false)}
              aria-label="Minimap — expand to view"
              title="Minimap"
            >
              <MinimapIcon />
            </button>
            <button
              type="button"
              className={styles.collapsedItem}
              onClick={() => setCollapsed(false)}
              aria-label="Tasks — expand to view"
              title="Tasks"
            >
              <TasksIcon />
            </button>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className={clsx(styles.rail, styles.railExpanded)} aria-label="Graph tools">
      <div className={styles.frame}>
        <header className={styles.header}>
          <h2 className={styles.headerTitle}>Tools</h2>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            aria-expanded={true}
          >
            <ChevronLeftIcon />
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.section} aria-label="Rings">
            <h3 className={styles.sectionHeading}>
              <span>Rings</span>
            </h3>
            <ul className={styles.filterList}>
              {RINGS.map((ring) => {
                const on = visibleRings.has(ring.tier)
                return (
                  <li key={ring.tier} className={styles.filterItem}>
                    <button
                      type="button"
                      className={clsx(styles.filterRow, styles[`ringRow${ring.tier}`], !on && styles.filterRowOff)}
                      onClick={() => toggleRing(ring.tier)}
                      aria-pressed={on}
                      title={ring.hint}
                    >
                      <span className={styles.filterDot} aria-hidden="true" />
                      <span className={styles.filterLabel}>{ring.label}</span>
                      <span className={styles.filterStatus}>{on ? 'Shown' : 'Hidden'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className={styles.section} aria-label="Connections">
            <h3 className={styles.sectionHeading}>
              <span>Connections</span>
            </h3>
            <button
              type="button"
              className={clsx(styles.filterRow, !showAllEdges && styles.filterRowOff)}
              onClick={() => setShowAllEdges(!showAllEdges)}
              aria-pressed={showAllEdges}
              title="When off, only the selected node's connections are visible. When on, every connection is drawn faintly."
            >
              <span className={styles.filterDot} aria-hidden="true" />
              <span className={styles.filterLabel}>Show all</span>
              <span className={styles.filterStatus}>{showAllEdges ? 'On' : 'Off'}</span>
            </button>
          </section>

          <section className={styles.section} aria-label="Memories">
            <h3 className={styles.sectionHeading}>
              <span>Memories</span>
            </h3>
            <button
              type="button"
              className={clsx(styles.filterRow, styles.memoryRow, !memoryLensOn && styles.filterRowOff)}
              onClick={() => setMemoryLensOn(!memoryLensOn)}
              aria-pressed={memoryLensOn}
              title="When on, memory bubbles appear on the canvas anchored to their linked people and places. Use the date slider at the bottom to narrow which ones show."
            >
              <span className={styles.filterDot} aria-hidden="true" />
              <span className={styles.filterLabel}>Memory lens</span>
              <span className={styles.filterStatus}>{memoryLensOn ? 'On' : 'Off'}</span>
            </button>
          </section>

          <section className={styles.section} aria-label="Minimap">
            <h3 className={styles.sectionHeading}>
              <span>Minimap</span>
            </h3>
            <div ref={minimapHostRef} className={styles.minimapHost} aria-hidden="true" />
          </section>

          <section className={styles.section} aria-label="Tasks">
            <h3 className={styles.sectionHeading}>
              <span>Tasks</span>
            </h3>
            <p className={styles.tasksPlaceholder}>
              Your tasks will appear here once calendar integration ships.
            </p>
          </section>
        </div>
      </div>
    </aside>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 3 4 7 9 11" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="5 3 10 7 5 11" />
    </svg>
  )
}

function RingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" />
      <circle cx="9" cy="9" r="5" />
      <circle cx="9" cy="9" r="2.5" />
      <circle cx="9" cy="9" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function MinimapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
      <rect x="6" y="6.5" width="6" height="4" rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="none" />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 4.5 7.5 7 5" />
      <line x1="9" y1="6" x2="15" y2="6" />
      <polyline points="3 11 4.5 12.5 7 10" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  )
}
