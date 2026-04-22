import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyEdgeChanges } from '@xyflow/react'
import type { Connection, Edge, Node, OnEdgesChange, Viewport } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import {
  getEdges,
  getGraphViewport,
  getNodes,
  saveGraphViewport,
  saveNodePositions,
  type NodeType,
} from '../firebase/graph'
import { edgeDocToReactFlowEdge } from '../graph/edgeHandles'
import { useDeferredEdgePersistence } from '../graph/useDeferredEdgePersistence'
import { AddNodePanel } from '../components/modals/AddNodeModal.tsx'
import { AddConnectionModal } from '../components/modals/AddConnectionModal.tsx'
import { NodeInfoModal } from '../components/modals/NodeInfoModal.tsx'
import { EdgeInfoModal } from '../components/modals/EdgeInfoModal.tsx'

type OpenPanel = 'addNode' | 'addConnection' | null

type SelectedNode = {
  id: string
  name: string
  type: string
  relationship?: string
  email?: string
  phone?: string
  address?: string
  photoPath?: string
  width?: number
  height?: number
}

type SelectedEdge = {
  id: string
  sourceName: string
  targetName: string
  sourceHandle?: string
  targetHandle?: string
}

const VALID_NODE_TYPES = new Set<NodeType>(['person', 'place', 'task'])

function firestoreNodesToReactFlow(nodes: Awaited<ReturnType<typeof getNodes>>): Node[] {
  return nodes
    .filter((doc) => VALID_NODE_TYPES.has(doc.type))
    .map((doc) => ({
    id: doc.id,
    type: doc.type,
    data: {
      name: doc.name,
      relationship: doc.relationship,
      email: doc.email,
      phone: doc.phone,
      address: doc.address,
      photoPath: doc.photoPath,
      photoUpdatedAt: doc.photoUpdatedAt,
      title: doc.title,
      startAt: doc.startAt,
      endAt: doc.endAt,
      calendarEventId: doc.calendarEventId,
      priority: doc.priority,
      location: doc.location,
      width: typeof doc.width === 'number' && Number.isFinite(doc.width) ? doc.width : undefined,
      height: typeof doc.height === 'number' && Number.isFinite(doc.height) ? doc.height : undefined,
    },
    position: doc.position ?? { x: 0, y: 0 },
  }))
}

function firestoreEdgesToReactFlow(edges: Awaited<ReturnType<typeof getEdges>>): Edge[] {
  return edges.map(edgeDocToReactFlowEdge)
}

function Graph() {
  const { user } = useAuth()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncEdgeError, setSyncEdgeError] = useState<string | null>(null)
  const [initialViewport, setInitialViewport] = useState<Viewport | undefined>(undefined)
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null)
  const flowKeyRef = useRef(0)
  const [flowKey, setFlowKey] = useState(0)

  const loadGraph = useCallback(async (opts?: { skipLoading?: boolean }) => {
    if (!user?.uid) {
      return;
    }

    if (!opts?.skipLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const [nodesData, edgesData, viewport] = await Promise.all([
        getNodes(user.uid, 'context'),
        getEdges(user.uid, 'context'),
        getGraphViewport(user.uid, 'context')
      ]);

      setNodes(firestoreNodesToReactFlow(nodesData));
      setEdges(firestoreEdgesToReactFlow(edgesData));
      setInitialViewport(viewport ?? undefined)

      flowKeyRef.current += 1
      setFlowKey(flowKeyRef.current)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      if (!opts?.skipLoading) {
        setLoading(false);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      setNodes([]);
      setEdges([]);
      return;
    }

    void loadGraph();
  }, [user?.uid, loadGraph]);

  const onEdgesChange = useCallback<OnEdgesChange>((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const { queueConnection, queueConnectionFromModal, flushPendingEdges, removePendingEdge } =
    useDeferredEdgePersistence(user?.uid, 'context', setEdges, setSyncEdgeError)

  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const name = typeof node.data.name === 'string' ? node.data.name : ''
    const relationship = typeof node.data.relationship === 'string' ? node.data.relationship : ''
    const email = typeof node.data.email === 'string' ? node.data.email : ''
    const phone = typeof node.data.phone === 'string' ? node.data.phone : ''
    const address = typeof node.data.address === 'string' ? node.data.address : ''
    const photoPath = typeof node.data.photoPath === 'string' ? node.data.photoPath : ''
    const w = node.data.width
    const h = node.data.height
    setSelectedNode({
      id: node.id,
      name,
      type: node.type ?? 'unknown',
      relationship,
      email,
      phone,
      address,
      photoPath,
      width: typeof w === 'number' && Number.isFinite(w) ? w : undefined,
      height: typeof h === 'number' && Number.isFinite(h) ? h : undefined,
    })
  }, [])

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const sourceName = nodes.find((n) => n.id === edge.source)?.data?.name as string ?? edge.source
    const targetName = nodes.find((n) => n.id === edge.target)?.data?.name as string ?? edge.target
    setSelectedEdge({
      id: edge.id,
      sourceName,
      targetName,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
    })
  }, [nodes])

  const handleConnectPersist = useCallback(
    (connection: Connection) => {
      if (!user?.uid) return
      queueConnection(connection)
    },
    [user?.uid, queueConnection],
  )

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
        <p>Loading your relationship graph…</p>
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

  const handleAddNodeSuccess = async () => {
    await flushPendingEdges()
    await loadGraph({ skipLoading: true })
  }

  // Render the graph
  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Relationship Graph</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Your personal map of the people and places around you.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => togglePanel('addNode')} className="home-auth-button"
            style={{
              marginTop: 0,
              opacity: openPanel === 'addNode' ? 0.7 : 1,
            }}
          >
            + Add Node
          </button>

          <button type="button" onClick={() => togglePanel('addConnection')} className="home-auth-toggle-button"
            style={{
              border: '1px solid #e5e7eb',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: openPanel === 'addConnection' ? '#e0f2fe' : undefined,
            }}
          >
            + Add Connection
          </button>
        </div>
      </div>

      {syncEdgeError ? (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.6rem 0.75rem',
            borderRadius: '0.5rem',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <p className="home-auth-error" style={{ margin: 0, flex: '1 1 12rem' }}>{syncEdgeError}</p>
          <button
            type="button"
            className="home-auth-toggle-button"
            style={{ border: '1px solid #e5e7eb', padding: '0.35rem 0.65rem', borderRadius: '0.375rem' }}
            onClick={() => setSyncEdgeError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {openPanel === 'addNode' && (
        <AddNodePanel
          userId={user.uid}
          onClose={() => setOpenPanel(null)}
          onSuccess={() => void handleAddNodeSuccess()}
        />
      )}

      {openPanel === 'addConnection' && (
        <AddConnectionModal
          userId={user.uid}
          onClose={() => setOpenPanel(null)}
          onQueueConnection={queueConnectionFromModal}
        />
      )}

      {selectedNode && (
        <NodeInfoModal
          userId={user.uid}
          nodeId={selectedNode.id}
          nodeName={selectedNode.name}
          nodeType={selectedNode.type}
          nodeRelationship={selectedNode.relationship ?? ''}
          nodeEmail={selectedNode.email ?? ''}
          nodePhone={selectedNode.phone ?? ''}
          nodeAddress={selectedNode.address ?? ''}
          nodePhotoPath={selectedNode.photoPath ?? ''}
          nodeWidth={selectedNode.width}
          nodeHeight={selectedNode.height}
          onClose={() => setSelectedNode(null)}
          onSuccess={() => {
            void (async () => {
              await flushPendingEdges()
              await loadGraph({ skipLoading: true })
              setSelectedNode(null)
            })()
          }}
        />
      )}

      {selectedEdge && (
        <EdgeInfoModal
          userId={user.uid}
          edgeId={selectedEdge.id}
          sourceName={selectedEdge.sourceName}
          targetName={selectedEdge.targetName}
          sourceHandle={selectedEdge.sourceHandle}
          targetHandle={selectedEdge.targetHandle}
          onClose={() => setSelectedEdge(null)}
          onEdgeDeleted={(edgeId) => {
            removePendingEdge(edgeId)
            setSelectedEdge(null)
          }}
        />
      )}

      <div
        style={{
          height: '75vh',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          border: '1px solid #e2e2e2',
        }}
      >
        <DefaultFlow
          key={`${user.uid}-${flowKey}`}
          nodes={nodes}
          edges={edges}
          onEdgesChange={onEdgesChange}
          defaultViewport={initialViewport}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onConnectPersist={handleConnectPersist}
          onSavePositions={(updatedNodes) => {
            void saveNodePositions(
              user.uid,
              updatedNodes.map((n) => ({ id: n.id, position: n.position })), 'context'
            );
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