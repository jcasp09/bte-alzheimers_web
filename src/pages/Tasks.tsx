import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { getEdges, getNodes } from '../firebase/graph'

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
    <section>
      <div
        style={{
          height: '80vh',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          border: '1px solid #e2e2e2',
        }}
      >
        <DefaultFlow
          key={`${user.uid}-${nodes.length}-${edges.length}-tasks`}
          nodes={nodes}
          edges={edges}
        />
      </div>
    </section>
  )
}

export default Tasks
