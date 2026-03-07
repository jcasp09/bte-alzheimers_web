import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { getEdges, getNodes } from '../firebase/graph'

function firestoreNodesToReactFlow(nodes: Awaited<ReturnType<typeof getNodes>>): Node[] {
  return nodes.map((doc) => ({
    id: doc.id,
    type: doc.type as 'person' | 'place',
    data: {
      name: doc.name,
      relationship: doc.relationship,
      email: doc.email,
      address: doc.address,
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
    Promise.all([getNodes(user.uid), getEdges(user.uid)])
      .then(([nodesData, edgesData]) => {
        if (cancelled) return
        setNodes(firestoreNodesToReactFlow(nodesData))
        setEdges(firestoreEdgesToReactFlow(edgesData))
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
        />
      </div>
    </section>
  )
}

export default Graph
