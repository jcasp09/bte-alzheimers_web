import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { getEdges, getNodes } from '../firebase/graph'
import './Tasks.css'

function firestoreNodesToReactFlow(nodes: Awaited<ReturnType<typeof getNodes>>): Node[] {
  return nodes.map((doc) => ({
    id: doc.id,
    type: doc.type,
    data: {
      name: doc.name,
      title: doc.title,
      startAt: doc.startAt,
      endAt: doc.endAt,
      priority: doc.priority,
      location: doc.location,
    },
    position: doc.position ?? { x: 0, y: 0 },
  }))
}

function firestoreEdgesToReactFlow(edges: Awaited<ReturnType<typeof getEdges>>): Edge[] {
  return edges.map((doc) => ({
    id: doc.id,
    source: doc.sourceNodeId,
    target: doc.targetNodeId,
    type: 'default',
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

function getTaskTitle(node: Node) {
  const data = node.data as Record<string, unknown>
  return (
    (typeof data.title === 'string' && data.title.trim()) ||
    (typeof data.name === 'string' && data.name.trim()) ||
    'Untitled task'
  )
}

function getTaskLocation(node: Node) {
  const data = node.data as Record<string, unknown>
  return typeof data.location === 'string' && data.location.trim() ? data.location : 'Location not set'
}

function getTaskStart(node: Node) {
  const data = node.data as Record<string, unknown>
  return typeof data.startAt === 'string' ? data.startAt : undefined
}

function getSortedTaskNodes(nodes: Node[]) {
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
    <div className={`tasks-summary-card ${featured ? 'tasks-summary-card-featured' : ''}`}>
      <div className={`tasks-summary-pill ${featured ? 'tasks-summary-pill-featured' : ''}`}>
        <span>{featured ? '●' : '○'}</span>
        <span>{label}</span>
      </div>

      <h2 className={`tasks-summary-title ${featured ? 'tasks-summary-title-featured' : ''}`}>
        {title}
      </h2>

      <p className={`tasks-summary-subtitle ${featured ? 'tasks-summary-subtitle-featured' : ''}`}>
        {subtitle}
      </p>

      <p className="tasks-summary-detail">{detail}</p>
    </div>
  )
}

function Tasks() {
  const { user } = useAuth()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) {
      queueMicrotask(() => {
        setLoading(false)
        setNodes([])
        setEdges([])
      })
      return
    }

    let cancelled = false

    queueMicrotask(() => {
      setLoading(true)
      setError(null)
    })

    Promise.all([getNodes(user.uid, 'tasks'), getEdges(user.uid, 'tasks')])
      .then(([nodesData, edgesData]) => {
        if (cancelled) return
        setNodes(firestoreNodesToReactFlow(nodesData))
        setEdges(firestoreEdgesToReactFlow(edgesData))
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tasks graph')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const sortedTasks = useMemo(() => getSortedTaskNodes(nodes), [nodes])

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
        <p className="home-auth-error">{error}</p>
      </section>
    )
  }

  return (
    <section className="tasks-page-shell">
      <div className="tasks-panel">
        <h1 className="tasks-page-title">Tasks</h1>
        <p className="tasks-page-subtitle">A calm, simple view of what matters most today.</p>

        <div className="tasks-summary-grid">
          <SummaryCard
            label="Today's Focus"
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

          <div className="tasks-secondary-grid">
            <SummaryCard
              label="Later Today"
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

      <div className="tasks-panel">
        <h2 className="tasks-section-title">Task Connections</h2>
        <p className="tasks-section-subtitle">
          Visual connections between routines, reminders, and important people.
        </p>

        <div className="tasks-flow-wrapper">
          <DefaultFlow
            key={`${user.uid}-${nodes.length}-${edges.length}-tasks`}
            nodes={nodes}
            edges={edges}
          />
        </div>
      </div>
    </section>
  )
}

export default Tasks