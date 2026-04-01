import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Edge, Node, Viewport } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { getEdges, getGraphViewport, getNodes, saveGraphViewport, saveNodePositions } from '../firebase/graph'

function firestoreNodesToReactFlow(nodes: Awaited<ReturnType<typeof getNodes>>): Node[] {
  return nodes.map((doc) => ({
    id: doc.id,
    type: doc.type,
    data: {
      name: doc.name,
      relationship: doc.relationship,
      email: doc.email,
      address: doc.address,
      title: doc.title,
      startAt: doc.startAt,
      endAt: doc.endAt,
      calendarEventId: doc.calendarEventId,
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

function Graph() {
  const { user } = useAuth()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialViewport, setInitialViewport] = useState<Viewport | undefined>(undefined)

  // Load nodes and edges from Firestore
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
    Promise.all([
      getNodes(user.uid, 'context'),
      getEdges(user.uid, 'context'),
      getGraphViewport(user.uid, 'context'),
    ])
      .then(([nodesData, edgesData, viewport]) => {
        if (cancelled) return
        setNodes(firestoreNodesToReactFlow(nodesData))
        setEdges(firestoreEdgesToReactFlow(edgesData))
        if (viewport) {
          setInitialViewport(viewport)
        } else {
          setInitialViewport(undefined)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load graph')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  // If user is not logged in, send to login page
  if (!user) {
    return (
      <section>
        <h1>Graph</h1>
        <p>Sign in to view your graph.</p>
        <Link to="/">Go to Home</Link>
      </section>
    )
  }

  // Loading state
  if (loading) {
    return (
      <section>
        <h1>Graph</h1>
        <p>Loading your graph…</p>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section>
        <h1>Graph</h1>
        <p className="home-auth-error">{error}</p>
      </section>
    )
  }

  // Render the graph
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
          key={`${user.uid}-${nodes.length}-${edges.length}`}
          nodes={nodes}
          edges={edges}
          defaultViewport={initialViewport}
          onSavePositions={(updatedNodes) => {
            // fire-and-forget; we don't need to block unmount on this
            void saveNodePositions(
              user.uid,
              updatedNodes.map((n) => ({
                id: n.id,
                position: n.position,
              })),
              'context',
            )
          }}
          onSaveViewport={(viewport) => {
            void saveGraphViewport(user.uid, viewport, 'context')
          }}
        />
      </div>
    </section>
  )
}

export default Graph
