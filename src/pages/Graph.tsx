import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Edge, Node, Viewport } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { getEdges, getGraphViewport, getNodes, saveGraphViewport, saveNodePositions, type NodeType } from '../firebase/graph'
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
}

type SelectedEdge = {
  id: string
  sourceName: string
  targetName: string
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
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null)
  const flowKeyRef = useRef(0)
  const [flowKey, setFlowKey] = useState(0)

  const loadGraph = useCallback(async () => {
    if (!user?.uid) {
      return;
    }

    setLoading(true);
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
      setLoading(false);
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

  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const name = typeof node.data.name === 'string' ? node.data.name : ''
    const relationship = typeof node.data.relationship === 'string' ? node.data.relationship : ''
    const email = typeof node.data.email === 'string' ? node.data.email : ''
    const phone = typeof node.data.phone === 'string' ? node.data.phone : ''
    const address = typeof node.data.address === 'string' ? node.data.address : ''
    setSelectedNode({
      id: node.id,
      name,
      type: node.type ?? 'unknown',
      relationship,
      email,
      phone,
      address,
    })
  }, [])

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const sourceName = nodes.find((n) => n.id === edge.source)?.data?.name as string ?? edge.source
    const targetName = nodes.find((n) => n.id === edge.target)?.data?.name as string ?? edge.target
    setSelectedEdge({ id: edge.id, sourceName, targetName })
  }, [nodes])

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

      {openPanel === 'addNode' && (
        <AddNodePanel userId={user.uid} onClose={() => setOpenPanel(null)} onSuccess={() => void loadGraph()} />
      )}

      {openPanel === 'addConnection' && (
        <AddConnectionModal userId={user.uid} onClose={() => setOpenPanel(null)} onSuccess={() => void loadGraph()} />
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
          onClose={() => setSelectedNode(null)}
          onSuccess={() => {
            void loadGraph();
            setSelectedNode(null)
          }}
        />
      )}

      {selectedEdge && (
        <EdgeInfoModal
          userId={user.uid}
          edgeId={selectedEdge.id}
          sourceName={selectedEdge.sourceName}
          targetName={selectedEdge.targetName}
          onClose={() => setSelectedEdge(null)}
          onSuccess={() => {
            void loadGraph();
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
          defaultViewport={initialViewport}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
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