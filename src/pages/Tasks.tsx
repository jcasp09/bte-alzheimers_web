import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthContext'
import { getNodes, removePassedTaskNodes } from '../graph/data/nodes'
import { GRAPH_IDS } from '../graph/model/types'
import type { NodeDoc } from '../graph/model/types'
import styles from './Tasks.module.css'

type TaskSummaryItem = {
  id: string
  type: NodeDoc['type']
  name: string
  title?: string
  startAt?: string
  endAt?: string
  priority?: number
  location?: string
}

function firestoreNodesToTaskItems(nodes: Awaited<ReturnType<typeof getNodes>>): TaskSummaryItem[] {
  return nodes.map((doc) => ({
    id: doc.id,
    type: doc.type,
    name: doc.name,
    title: doc.title,
    startAt: doc.startAt,
    endAt: doc.endAt,
    priority: doc.priority,
    location: doc.location,
  }))
}

function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime())
}

function formatTaskTime(value?: string) {
  if (!value || !isValidDate(value)) return 'Time not set'

  const date = new Date(value)
  const now = new Date()

  const isToday = date.toDateString() === now.toDateString()

  const tomorrow = new Date()
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const time = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (isToday) return `Today · ${time}`
  if (isTomorrow) return `Tomorrow · ${time}`

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getTaskTitle(node: TaskSummaryItem) {
  return (
    (typeof node.title === 'string' && node.title.trim()) ||
    (typeof node.name === 'string' && node.name.trim()) ||
    'Untitled task'
  )
}

function getTaskLocation(node: TaskSummaryItem) {
  return typeof node.location === 'string' && node.location.trim() ? node.location : 'Location not set'
}

function getTaskStart(node: TaskSummaryItem) {
  return typeof node.startAt === 'string' ? node.startAt : undefined
}

function isNodePassed(node: TaskSummaryItem, nowMs: number): boolean {
  if (node.type !== 'task') return false
  if (typeof node.endAt !== 'string') return false
  const endMs = new Date(node.endAt).getTime()
  return !Number.isNaN(endMs) && endMs < nowMs
}

function getSortedTaskNodes(nodes: TaskSummaryItem[]) {
  return [...nodes].sort((a, b) => {
    const aStart = getTaskStart(a)
    const bStart = getTaskStart(b)

    if (!aStart && !bStart) return 0
    if (!aStart) return 1
    if (!bStart) return -1

    return new Date(aStart).getTime() - new Date(bStart).getTime()
  })
}

type SummaryCardProps = {
  label: string
  title: string
  subtitle: string
  detail: string
  featured?: boolean
}

function SummaryCard({ label, title, subtitle, detail, featured = false }: SummaryCardProps) {
  return (
    <div className={clsx(styles.summaryCard, featured && styles.summaryCardFeatured)}>
      <div className={clsx(styles.summaryPill, featured && styles.summaryPillFeatured)}>
        <span>{featured ? '●' : '○'}</span>
        <span>{label}</span>
      </div>

      <h2 className={clsx(styles.summaryTitle, featured && styles.summaryTitleFeatured)}>
        {title}
      </h2>

      <p className={clsx(styles.summarySubtitle, featured && styles.summarySubtitleFeatured)}>
        {subtitle}
      </p>

      <p className={styles.summaryDetail}>{detail}</p>
    </div>
  )
}
function Tasks() {
  const { user } = useAuth()
  const [nodes, setNodes] = useState<TaskSummaryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedUid, setLoadedUid] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid)
      return

    const uid = user.uid
    let cancelled = false

    Promise.resolve(removePassedTaskNodes(uid))
      .then(() => getNodes(uid, GRAPH_IDS.tasks))
      .then((nodesData) => {
        if (cancelled)
          return

        const nowMs = Date.now()
        const items = firestoreNodesToTaskItems(nodesData).filter((node) => !isNodePassed(node, nowMs))
        setError(null)
        setNodes(items)
        setLoadedUid(uid)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load tasks graph')
      })

    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const loading = user?.uid != null && loadedUid !== user.uid && error === null

  const sortedTasks = useMemo(() => getSortedTaskNodes(nodes ?? []), [nodes])

  const todayFocus = sortedTasks[0]
  const laterToday = sortedTasks[1]
  const comingUp = sortedTasks[2]

  if (!user) {
    return (
      <section>
        <h1>Tasks</h1>
        <p>Sign in to view your calendar task graph.</p>
        <Link to="/">Go to Home</Link>
      </section>
    )
  }

  if (loading) {
    return (
      <section>
        <h1>Tasks</h1>
        <p>Loading your task graph...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h1>Tasks</h1>
        <p className="text-error">{error}</p>
      </section>
    )
  }

  return (
    <section className={styles.pageShell}>
      <div className={styles.panel}>
        <h1 className={styles.pageTitle}>Tasks</h1>
        <p className={styles.pageSubtitle}>A calm, simple view of what matters most today.</p>

        <div className={styles.summaryGrid}>
          <SummaryCard
            label="Up Next"
            title={todayFocus ? getTaskTitle(todayFocus) : 'No upcoming task yet'}
            subtitle={
              todayFocus
                ? formatTaskTime(getTaskStart(todayFocus))
                : 'Add or sync a task to get started'
            }
            detail={
              todayFocus
                ? getTaskLocation(todayFocus)
                : 'Your next important task will appear here.'
            }
            featured
          />

          <div className={styles.secondaryGrid}>
            <SummaryCard
              label="Coming Up"
              title={laterToday ? getTaskTitle(laterToday) : 'Nothing else scheduled'}
              subtitle={
                laterToday ? formatTaskTime(getTaskStart(laterToday)) : 'You are all caught up'
              }
              detail={laterToday ? getTaskLocation(laterToday) : 'No additional task found.'}
            />

            <SummaryCard
              label="Coming Up"
              title={comingUp ? getTaskTitle(comingUp) : 'No upcoming reminder'}
              subtitle={
                comingUp
                  ? formatTaskTime(getTaskStart(comingUp))
                  : 'Check back after syncing more tasks'
              }
              detail={comingUp ? getTaskLocation(comingUp) : 'Future tasks will appear here.'}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default Tasks
