import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import clsx from 'clsx'
import { RINGS, type RingTier } from '../../../graph/model/rings'
import type { UpcomingTask } from '../../../graph/data/tasks'
import type { PickableNode } from '../../../graph/model/types'
import { usePhotoUrl } from '../../../shared/hooks/usePhotoUrl'
import { getInitialsForAvatar } from '../../../shared/util/initials'
import {
  readSectionOpenPref,
  type SidebarSectionId,
  writeSectionOpenPref,
  writeSidebarCollapsedPref,
} from './graphLeftSidebarPrefs'
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
  tasks: UpcomingTask[]
  pickableNodes: PickableNode[]
  onAddTask: () => void
  onTaskClick: (taskId: string) => void
}

const MAX_LINKED_AVATAR_PREVIEW = 4

function formatTaskTime(value?: string): string {
  if (typeof value !== 'string' || value.length === 0) return 'Time not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time not set'

  const now = new Date()
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return `Today · ${time}`

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getTaskTitle(task: UpcomingTask): string {
  if (typeof task.title === 'string' && task.title.trim().length > 0) return task.title
  if (typeof task.name === 'string' && task.name.trim().length > 0) return task.name
  return 'Untitled task'
}

function LinkedAvatar({ name, photoPath }: { name: string; photoPath?: string }) {
  const url = usePhotoUrl(photoPath)
  const initials = getInitialsForAvatar(name) || '?'
  return (
    <span className={styles.taskLinkedAvatar} title={name}>
      {url ? (
        <img src={url} alt="" className={styles.taskLinkedAvatarImage} />
      ) : (
        initials
      )}
    </span>
  )
}

type TaskRowProps = {
  task: UpcomingTask
  pickableById: Map<string, PickableNode>
  onClick: () => void
}

function TaskRow({ task, pickableById, onClick }: TaskRowProps) {
  const title = getTaskTitle(task)
  const timeLabel = formatTaskTime(task.startAt)
  const location = typeof task.location === 'string' ? task.location.trim() : ''
  const linkedAll = useMemo(() => {
    const ids = Array.isArray(task.linkedNodeIds) ? task.linkedNodeIds : []
    return ids
      .map((id) => pickableById.get(id))
      .filter((n): n is PickableNode => n != null)
  }, [task.linkedNodeIds, pickableById])
  const linkedPreview = linkedAll.slice(0, MAX_LINKED_AVATAR_PREVIEW)
  const overflow = linkedAll.length - linkedPreview.length

  return (
    <button
      type="button"
      className={styles.taskRow}
      onClick={onClick}
      aria-label={`Open task: ${title}`}
    >
      <span className={styles.taskRowHead}>
        <span className={styles.taskTitle}>{title}</span>
        <span className={styles.taskTime}>{timeLabel}</span>
      </span>
      {location ? <span className={styles.taskLocation}>{location}</span> : null}
      {linkedAll.length > 0 ? (
        <span className={styles.taskLinkedStrip} aria-hidden="true">
          {linkedPreview.map((n) => (
            <LinkedAvatar key={n.id} name={n.name} photoPath={n.photoPath} />
          ))}
          {overflow > 0 ? (
            <span className={styles.taskLinkedOverflow}>+{overflow}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  )
}

type CollapsibleSectionProps = {
  id: SidebarSectionId
  label: string
  badge?: ReactNode
  headerActions?: ReactNode
  ariaLabel?: string
  children: ReactNode
}

function CollapsibleSection({
  id,
  label,
  badge,
  headerActions,
  ariaLabel,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState<boolean>(() => readSectionOpenPref(id))
  const lastWrittenRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (lastWrittenRef.current === open) return
    lastWrittenRef.current = open
    writeSectionOpenPref(id, open)
  }, [id, open])

  const bodyId = `sidebar-section-body-${id}`
  return (
    <section className={styles.section} aria-label={ariaLabel ?? label}>
      <h3 className={styles.sectionHeading}>
        <button
          type="button"
          className={styles.sectionHeaderButton}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={clsx(styles.sectionHeaderChevron, open && styles.sectionHeaderChevronOpen)} aria-hidden="true">
            <ChevronTinyIcon />
          </span>
          <span>{label}</span>
          {badge}
        </button>
        {headerActions ? (
          <span className={styles.sectionHeaderActions}>{headerActions}</span>
        ) : null}
      </h3>
      {open ? (
        <div id={bodyId} className={styles.sectionContent}>
          {children}
        </div>
      ) : null}
    </section>
  )
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
  tasks,
  pickableNodes,
  onAddTask,
  onTaskClick,
}: Props) {
  const lastWrittenRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (lastWrittenRef.current === collapsed) return
    lastWrittenRef.current = collapsed
    writeSidebarCollapsedPref(collapsed)
  }, [collapsed])

  const pickableById = useMemo<Map<string, PickableNode>>(() => {
    const m = new Map<string, PickableNode>()
    for (const n of pickableNodes) m.set(n.id, n)
    return m
  }, [pickableNodes])

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
              aria-label={tasks.length > 0 ? `Tasks (${tasks.length} upcoming) - expand to view` : 'Tasks - expand to view'}
              title="Tasks"
            >
              <TasksIcon />
              {tasks.length > 0 ? <span className={styles.collapsedItemBadge} aria-hidden="true" /> : null}
            </button>
            <button
              type="button"
              className={styles.collapsedItem}
              onClick={() => setCollapsed(false)}
              aria-label={hasRingsOff ? 'Rings (some hidden) - expand to adjust' : 'Rings - expand to adjust'}
              title="Rings"
            >
              <RingsIcon />
              {hasRingsOff ? <span className={styles.collapsedItemBadge} aria-hidden="true" /> : null}
            </button>
            <button
              type="button"
              className={styles.collapsedItem}
              onClick={() => setCollapsed(false)}
              aria-label="Minimap - expand to view"
              title="Minimap"
            >
              <MinimapIcon />
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
          <CollapsibleSection
            id="tasks"
            label="Tasks"
            headerActions={
              <button
                type="button"
                className={styles.sectionHeaderAction}
                onClick={onAddTask}
                aria-label="Add a task"
                title="Add a task"
              >
                <PlusTinyIcon />
              </button>
            }
          >
            {tasks.length === 0 ? (
              <p className={styles.tasksEmpty}>
                Nothing upcoming. Tap + to add one.
              </p>
            ) : (
              <div className={styles.tasksList}>
                {tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    pickableById={pickableById}
                    onClick={() => onTaskClick(t.id)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="rings" label="Rings">
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
          </CollapsibleSection>

          <CollapsibleSection id="connections" label="Connections">
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
          </CollapsibleSection>

          <CollapsibleSection id="memories" label="Memories">
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
          </CollapsibleSection>

          <CollapsibleSection id="minimap" label="Minimap">
            <div ref={minimapHostRef} className={styles.minimapHost} aria-hidden="true" />
          </CollapsibleSection>
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

function ChevronTinyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 2 7 5 3 8" />
    </svg>
  )
}

function PlusTinyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="2.5" x2="6" y2="9.5" />
      <line x1="2.5" y1="6" x2="9.5" y2="6" />
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
