import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Edge, Node, Viewport } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { getEdges, getGraphViewport, getNodes, saveGraphViewport, saveNodePositions } from '../firebase/graph'
import { AddNodePanel } from '../components/modals/AddNodeModal.tsx'
import { AddConnectionModal } from '../components/modals/AddConnectionModal.tsx'
import { DeleteNodeModal } from '../components/modals/DeleteNodeModal.tsx'
import { DeleteConnectionModal } from '../components/modals/DeleteConnectionModal.tsx'

type OpenPanel = 'addNode' | 'addConnection' | 'deleteNode' | 'deleteConnection' | null

const CONTEXT_NODE_TYPES = new Set(['person', 'place', 'task'])

function firestoreNodesToReactFlow(nodes: Awaited<ReturnType<typeof getNodes>>): Node[] {
  return nodes
    .filter(
      (doc) =>
        CONTEXT_NODE_TYPES.has(doc.type) &&
        // Drop corrupted / position-only ghosts (e.g. from stale save after delete)
        Boolean(typeof doc.name === 'string' && doc.name.trim().length > 0 || doc.type === 'task'),
    )
    .map((doc) => ({
      id: doc.id,
      type: doc.type,
      data: {
        name: doc.name,
        relationship: doc.relationship,
        email: doc.email,
        phone: doc.phone,
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

          <button type="button" onClick={() => togglePanel('deleteNode')} className="home-auth-toggle-button"
            style={{
              border: '1px solid #e5e7eb',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: openPanel === 'deleteNode' ? '#fee2e2' : undefined,
            }}
          >
            - Delete Node
          </button>

          <button type="button" onClick={() => togglePanel('deleteConnection')} className="home-auth-toggle-button"
            style={{
              border: '1px solid #e5e7eb',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: openPanel === 'deleteConnection' ? '#fee2e2' : undefined,
            }}
          >
            - Delete Connection
          </button>
        </div>
      </div>

      {openPanel === 'addNode' && (
        <AddNodePanel userId={user.uid} onClose={() => setOpenPanel(null)} onSuccess={() => void loadGraph()} />
      )}

      {openPanel === 'addConnection' && (
        <AddConnectionModal userId={user.uid} onClose={() => setOpenPanel(null)} onSuccess={() => void loadGraph()} />
      )}

      {openPanel === 'deleteNode' && (
        <DeleteNodeModal userId={user.uid} onClose={() => setOpenPanel(null)} onSuccess={() => void loadGraph()} />
      )}
      {openPanel === 'deleteConnection' && (
        <DeleteConnectionModal userId={user.uid} onClose={() => setOpenPanel(null)} onSuccess={() => void loadGraph()} />
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
          key={`${user.uid}-${nodes.length}-${edges.length}`}
          nodes={nodes}
          edges={edges}
          defaultViewport={initialViewport}
          onSavePositions={(updatedNodes) => {
            // fire-and-forget; we don't need to block unmount on this
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