import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyEdgeChanges } from '@xyflow/react'
import type { Connection, Edge, Node, OnEdgesChange } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { getEdges, getNodes } from '../firebase/graph'
import { edgeDocToReactFlowEdge } from '../graph/edgeHandles'
import { useDeferredEdgePersistence } from '../graph/useDeferredEdgePersistence'

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
  return edges.map(edgeDocToReactFlowEdge)
}

function Tasks() {
  const { user } = useAuth()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncEdgeError, setSyncEdgeError] = useState<string | null>(null)
  const [flowKey, setFlowKey] = useState(0)

  const loadGraph = useCallback(
    async (opts?: { skipLoading?: boolean }) => {
      if (!user?.uid) return
      if (!opts?.skipLoading) {
        setLoading(true)
      }
      setError(null)
      try {
        const [nodesData, edgesData] = await Promise.all([
          getNodes(user.uid, 'tasks'),
          getEdges(user.uid, 'tasks'),
        ])
        setNodes(firestoreNodesToReactFlow(nodesData))
        setEdges(firestoreEdgesToReactFlow(edgesData))
        setFlowKey((k) => k + 1)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks graph')
      } finally {
        if (!opts?.skipLoading) {
          setLoading(false)
        }
      }
    },
    [user?.uid],
  )

  useEffect(() => {
    if (!user?.uid) {
      queueMicrotask(() => {
        setLoading(false)
        setNodes([])
        setEdges([])
      })
      return
    }
    void loadGraph()
  }, [user?.uid, loadGraph])

  const onEdgesChange = useCallback<OnEdgesChange>((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const { queueConnection } = useDeferredEdgePersistence(
    user?.uid,
    'tasks',
    setEdges,
    setSyncEdgeError,
  )

  const handleConnectPersist = useCallback(
    (connection: Connection) => {
      if (!user?.uid) return
      queueConnection(connection)
    },
    [user?.uid, queueConnection],
  )

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
      {syncEdgeError ? (
        <p className="home-auth-error" style={{ marginBottom: '0.5rem' }}>{syncEdgeError}</p>
      ) : null}
      <div
        style={{
          height: '80vh',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          border: '1px solid #e2e2e2',
        }}
      >
        <DefaultFlow
          key={`${user.uid}-${flowKey}-tasks`}
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          onConnectPersist={handleConnectPersist}
        />
      </div>
    </section>
  )
}

export default Tasks
