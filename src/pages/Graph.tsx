import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import type { Connection, Edge, Node, OnEdgesChange, OnNodesChange, Viewport } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import {
  GRAPH_IDS,
  getEdges,
  getGraphViewport,
  getNodes,
  saveGraphViewport,
  saveNodePositions,
  updateEdgeLabel,
  type NodeDoc,
  type NodeType,
  type PickableNode,
} from '../firebase/graph'
import { GROUP_DRAW_BOUNDS, GROUP_NODE_DEFAULT_SIZE } from '../graph/dimensions'
import { edgeDocToReactFlowEdge } from '../graph/edgeHandles'
import { applyReparentOnDragStop } from '../graph/reparent'
import { isLocalPendingEdgeId, useDeferredEdgePersistence } from '../graph/useDeferredEdgePersistence'
import { AddNodePanel } from '../components/modals/AddNodeModal.tsx'
import { AddConnectionModal } from '../components/modals/AddConnectionModal.tsx'
import { AddGroupModal } from '../components/modals/AddGroupModal.tsx'
import { NodeInfoModal } from '../components/modals/NodeInfoModal.tsx'
import { EdgeInfoModal } from '../components/modals/EdgeInfoModal.tsx'

type OpenPanel = 'addNode' | 'addConnection' | null

type XY = { x: number; y: number }

type AddGroupPlacement =
  | { status: 'idle' }
  | { status: 'picking'; phase: 1 }
  | { status: 'picking'; phase: 2; p1: XY }

function rectFromCorners(p1: XY, p2: XY): { x: number; y: number; width: number; height: number } {
  const x = Math.min(p1.x, p2.x)
  const y = Math.min(p1.y, p2.y)
  const width = Math.min(GROUP_DRAW_BOUNDS.max, Math.max(GROUP_DRAW_BOUNDS.minW, Math.abs(p2.x - p1.x)))
  const height = Math.min(GROUP_DRAW_BOUNDS.max, Math.max(GROUP_DRAW_BOUNDS.minH, Math.abs(p2.y - p1.y)))
  return { x, y, width, height }
}

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
  label?: string
}

const CONTEXT_GRAPH_NODE_TYPES = new Set<NodeType>(['person', 'place', 'group'])

function sortContextGraphDocs(docs: NodeDoc[]): NodeDoc[] {
  const inScope = docs.filter((d) => CONTEXT_GRAPH_NODE_TYPES.has(d.type))
  const roots = inScope.filter((d) => !d.parentId)
  const children = inScope.filter((d) => d.parentId)
  roots.sort((a, b) => {
    const ag = a.type === 'group' ? 0 : 1
    const bg = b.type === 'group' ? 0 : 1
    if (ag !== bg) return ag - bg
    return a.id.localeCompare(b.id)
  })
  children.sort((a, b) => {
    const p = (a.parentId ?? '').localeCompare(b.parentId ?? '')
    if (p !== 0) return p
    return a.id.localeCompare(b.id)
  })
  return [...roots, ...children]
}

function docToReactFlowNode(doc: NodeDoc): Node | null {
  if (!CONTEXT_GRAPH_NODE_TYPES.has(doc.type)) return null

  if (doc.type === 'group') {
    const w =
      typeof doc.width === 'number' && Number.isFinite(doc.width)
        ? doc.width
        : GROUP_NODE_DEFAULT_SIZE.width
    const h =
      typeof doc.height === 'number' && Number.isFinite(doc.height)
        ? doc.height
        : GROUP_NODE_DEFAULT_SIZE.height
    return {
      id: doc.id,
      type: 'group',
      parentId: doc.parentId,
      position: doc.position ?? { x: 0, y: 0 },
      width: w,
      height: h,
      zIndex: -1,
      data: { name: doc.name },
    }
  }

  return {
    id: doc.id,
    type: doc.type,
    parentId: doc.parentId,
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
  }
}

function firestoreNodesToReactFlow(nodes: NodeDoc[]): Node[] {
  return sortContextGraphDocs(nodes)
    .map(docToReactFlowNode)
    .filter((n): n is Node => n != null)
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
  const [addGroupPlacement, setAddGroupPlacement] = useState<AddGroupPlacement>({ status: 'idle' })
  const [pendingGroupRect, setPendingGroupRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const addGroupPlacementRef = useRef<AddGroupPlacement>({ status: 'idle' })
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
        getNodes(user.uid, GRAPH_IDS.context),
        getEdges(user.uid, GRAPH_IDS.context),
        getGraphViewport(user.uid, GRAPH_IDS.context)
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

  const onNodesChange = useCallback<OnNodesChange>((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  const onNodeDragStop = useCallback((_e: MouseEvent, node: Node) => {
    setNodes((nds) => {
      const merged = nds.map((n) => (n.id === node.id ? { ...n, ...node, position: node.position } : n))
      return applyReparentOnDragStop(merged, node.id)
    })
  }, [])

  useEffect(() => {
    addGroupPlacementRef.current = addGroupPlacement
  }, [addGroupPlacement])

  const handlePaneFlowClick = useCallback((point: XY) => {
    const cur = addGroupPlacementRef.current
    if (cur.status !== 'picking') return
    if (cur.phase === 1) {
      const next: AddGroupPlacement = { status: 'picking', phase: 2, p1: point }
      addGroupPlacementRef.current = next
      setAddGroupPlacement(next)
      return
    }
    const rect = rectFromCorners(cur.p1, point)
    setPendingGroupRect(rect)
    addGroupPlacementRef.current = { status: 'idle' }
    setAddGroupPlacement({ status: 'idle' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (addGroupPlacementRef.current.status === 'picking') {
        addGroupPlacementRef.current = { status: 'idle' }
        setAddGroupPlacement({ status: 'idle' })
        return
      }
      if (pendingGroupRect) {
        setPendingGroupRect(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingGroupRect])

  const {
    queueConnection,
    updatePendingEdgeLabel,
    flushPendingEdges,
    removePendingEdge,
  } = useDeferredEdgePersistence(user?.uid, GRAPH_IDS.context, setEdges, setSyncEdgeError)

  // Derive the pickable nodes from the graph state
  const pickableNodes = useMemo<PickableNode[]>(() => {
    const out: PickableNode[] = []
    for (const n of nodes) {
      if (n.type !== 'person' && n.type !== 'place')
        continue

      const name = typeof n.data?.name === 'string' ? n.data.name : ''
      if (!name)
        continue

      out.push({ id: n.id, type: n.type, name })
    }
    return out
  }, [nodes])

  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (addGroupPlacementRef.current.status === 'picking')
      return

    const name = typeof node.data.name === 'string' ? node.data.name : ''
    const relationship = typeof node.data.relationship === 'string' ? node.data.relationship : ''
    const email = typeof node.data.email === 'string' ? node.data.email : ''
    const phone = typeof node.data.phone === 'string' ? node.data.phone : ''
    const address = typeof node.data.address === 'string' ? node.data.address : ''
    const photoPath = typeof node.data.photoPath === 'string' ? node.data.photoPath : ''
    const w = node.type === 'group' ? node.width : node.data.width
    const h = node.type === 'group' ? node.height : node.data.height

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
    if (addGroupPlacementRef.current.status === 'picking')
      return

    const sourceName = nodes.find((n) => n.id === edge.source)?.data?.name as string ?? edge.source
    const targetName = nodes.find((n) => n.id === edge.target)?.data?.name as string ?? edge.target
    const rawLabel = edge.label
    const label = typeof rawLabel === 'string' ? rawLabel : typeof rawLabel === 'number' ? String(rawLabel) : ''

    setSelectedEdge({
      id: edge.id,
      sourceName,
      targetName,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      label,
    })
  }, [nodes])

  const handleSaveEdgeLabel = useCallback(
    async (edgeId: string, label: string) => {
      if (!user?.uid)
        return

      if (isLocalPendingEdgeId(edgeId)) {
        updatePendingEdgeLabel(edgeId, label)
        return
      }

      await updateEdgeLabel(user.uid, edgeId, label, GRAPH_IDS.context)
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId)
            return e
          
          const next: Edge = { ...e }
          const t = label.trim()

          if (t.length > 0) {
            next.label = t
          } else {
            delete next.label
          }
          return next
        }),
      )
    },
    [user?.uid, updatePendingEdgeLabel],
  )

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
          <button
            type="button"
            onClick={() => togglePanel('addNode')}
            style={{
              marginTop: 0,
              border: '1px solid #d1d5db',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: openPanel === 'addNode' ? '#e5e7eb' : '#f3f4f6',
              color: '#374151',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            + Add Node
          </button>

          <button
            type="button"
            onClick={() => togglePanel('addConnection')}
            style={{
              marginTop: 0,
              border: '1px solid #d1d5db',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: openPanel === 'addConnection' ? '#e5e7eb' : '#f3f4f6',
              color: '#374151',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            + Add Connection
          </button>

          <button
            type="button"
            onClick={() => {
              if (addGroupPlacement.status === 'picking') {
                addGroupPlacementRef.current = { status: 'idle' }
                setAddGroupPlacement({ status: 'idle' })
                setPendingGroupRect(null)
                return
              }
              addGroupPlacementRef.current = { status: 'picking', phase: 1 }
              setAddGroupPlacement({ status: 'picking', phase: 1 })
            }}
            style={{
              marginTop: 0,
              border: '1px solid #d1d5db',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: addGroupPlacement.status === 'picking' ? '#e5e7eb' : '#f3f4f6',
              color: '#374151',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            + Add group
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
          pickableNodes={pickableNodes}
          onClose={() => setOpenPanel(null)}
          onSuccess={() => void handleAddNodeSuccess()}
        />
      )}

      {openPanel === 'addConnection' && (
        <AddConnectionModal
          pickableNodes={pickableNodes}
          onClose={() => setOpenPanel(null)}
          onQueueConnection={queueConnection}
        />
      )}

      {pendingGroupRect && (
        <AddGroupModal
          userId={user.uid}
          draftRect={pendingGroupRect}
          onClose={() => {
            setPendingGroupRect(null)
            addGroupPlacementRef.current = { status: 'idle' }
            setAddGroupPlacement({ status: 'idle' })
          }}
          onSuccess={() => {
            setPendingGroupRect(null)
            void handleAddNodeSuccess()
          }}
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
          edgeLabel={selectedEdge.label ?? ''}
          onClose={() => setSelectedEdge(null)}
          onEdgeDeleted={(edgeId) => {
            removePendingEdge(edgeId)
            setSelectedEdge(null)
          }}
          onSaveEdgeLabel={handleSaveEdgeLabel}
        />
      )}

      {addGroupPlacement.status === 'picking' ? (
        <p
          style={{
            margin: '0 0 0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            background: '#e0f2fe',
            border: '1px solid #7dd3fc',
            color: '#0c4a6e',
            fontSize: 14,
          }}
        >
          {addGroupPlacement.phase === 1
            ? 'Click the top-left corner of the new group on the graph, then the bottom-right. Pan with middle or right mouse drag, or the scroll wheel. Press Esc to cancel.'
            : 'Now click the bottom-right corner. Esc to cancel.'}
        </p>
      ) : null}

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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onPaneFlowClick={addGroupPlacement.status === 'picking' ? handlePaneFlowClick : undefined}
          groupPlacementPanMode={addGroupPlacement.status === 'picking'}
          defaultViewport={initialViewport}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onConnectPersist={handleConnectPersist}
          onSavePositions={(updatedNodes) => {
            void saveNodePositions(
              user.uid,
              updatedNodes.map((n) => ({
                id: n.id,
                position: n.position,
                parentId: n.parentId ?? null,
              })),
              GRAPH_IDS.context,
            )
          }}
          onSaveViewport={(viewport) => {
            void saveGraphViewport(user.uid, viewport, GRAPH_IDS.context)
          }}
        />
      </div>
    </section>
  )
}

export default Graph
