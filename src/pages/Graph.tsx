import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import type { Connection, Edge, Node, OnEdgesChange, OnNodesChange, Viewport } from '@xyflow/react'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../services/storage'
import { useAuth } from '../contexts/AuthContext'
import { DefaultFlow } from '../components/DefaultFlow'
import { DOCK_NODE_DND_TYPE, GRAPH_TRANSLATE_EXTENT, type DefaultFlowHandle } from '../components/flowConstants'
import styles from './Graph.module.css'
import {
  GRAPH_IDS,
  getEdges,
  getGraphViewport,
  getNodes,
  saveGraphViewport,
  saveNodePositions,
  updateEdgeLabel,
} from '../services/graph'
import type { NodeDoc, NodeType, PickableNode } from '../types/graph'
import { GROUP_DRAW_BOUNDS, GROUP_NODE_DEFAULT_SIZE } from '../graph/dimensions'
import { edgeDocToReactFlowEdge } from '../graph/edgeHandles'
import { applyReparentOnDragStop } from '../graph/reparent'
import { isLocalPendingEdgeId, useDeferredEdgePersistence } from '../hooks/useDeferredEdgePersistence'
import { AddNodePanel } from '../components/modals/AddNodeModal.tsx'
import { AddConnectionModal } from '../components/modals/AddConnectionModal.tsx'
import { AddGroupModal } from '../components/modals/AddGroupModal.tsx'
import { NodeInfoModal } from '../components/modals/NodeInfoModal.tsx'
import { EdgeInfoModal } from '../components/modals/EdgeInfoModal.tsx'

type OpenPanel = 'addPerson' | 'addPlace' | 'addConnection' | null

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

type VisibleTypes = { person: boolean; place: boolean; group: boolean }

const DEFAULT_VISIBLE_TYPES: VisibleTypes = { person: true, place: true, group: true }

// Four corner nodes to anchor the minimap
const ANCHOR_NODES: Node[] = (() => {
  const [[minX, minY], [maxX, maxY]] = GRAPH_TRANSLATE_EXTENT
  const baseProps = {
    type: 'anchor',
    width: 1,
    height: 1,
    data: {},
    draggable: false,
    selectable: false,
    connectable: false,
    deletable: false,
    focusable: false,
  } as const
  return [
    { id: '__anchor_tl', position: { x: minX, y: minY }, ...baseProps },
    { id: '__anchor_tr', position: { x: maxX, y: minY }, ...baseProps },
    { id: '__anchor_bl', position: { x: minX, y: maxY }, ...baseProps },
    { id: '__anchor_br', position: { x: maxX, y: maxY }, ...baseProps },
  ]
})()

const photoUrlCache = new Map<string, string>()

function useResolvedPhotoUrl(photoPath: string | undefined): string | null {
  const [, forceRender] = useState(0)
  const url = photoPath ? photoUrlCache.get(photoPath) ?? null : null

  useEffect(() => {
    if (!photoPath || photoUrlCache.has(photoPath)) return
    let cancelled = false
    void getDownloadURL(ref(storage, photoPath))
      .then((u) => {
        if (cancelled) return
        photoUrlCache.set(photoPath, u)
        forceRender((c) => c + 1)
      })
      .catch(() => { /* ignore, fall back to no image */ })
    return () => { cancelled = true }
  }, [photoPath])

  return url
}

/** Lower number = higher priority in the search dropdown. */
function typePriority(type: string): number {
  switch (type) {
    case 'person': return 0
    case 'place': return 1
    case 'group': return 2
    case 'moment': return 3
    case 'task': return 4
    default: return 99
  }
}

function SearchResultThumb({ photoPath }: { photoPath: string | undefined }) {
  const url = useResolvedPhotoUrl(photoPath)
  if (!url) return null
  return <img src={url} alt="" className={styles.searchResultThumb} />
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
  const [pendingNodePosition, setPendingNodePosition] = useState<XY | null>(null)
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
  const flowRef = useRef<DefaultFlowHandle>(null)
  const [visibleTypes, setVisibleTypes] = useState<VisibleTypes>(DEFAULT_VISIBLE_TYPES)
  const [searchQuery, setSearchQuery] = useState('')
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

  const displayNodes = useMemo(() => {
    const filtered = nodes.map((n) => {
      const t = n.type
      const allowed = (t === 'person' && visibleTypes.person)
        || (t === 'place' && visibleTypes.place)
        || (t === 'group' && visibleTypes.group)
      return allowed ? n : { ...n, hidden: true }
    })
    return [...ANCHOR_NODES, ...filtered]
  }, [nodes, visibleTypes])

  const displayEdges = useMemo(() => {
    const visible = new Set(displayNodes.filter((n) => !n.hidden).map((n) => n.id))
    return edges.map((e) => ({
      ...e,
      hidden: !(visible.has(e.source) && visible.has(e.target)),
    }))
  }, [edges, displayNodes])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return [] as { id: string; name: string; type: string; photoPath: string | undefined }[]
    const all: { id: string; name: string; type: string; photoPath: string | undefined }[] = []
    for (const n of nodes) {
      if (n.type !== 'person' && n.type !== 'place' && n.type !== 'group') continue
      const name = typeof n.data?.name === 'string' ? n.data.name : ''
      if (!name) continue
      if (name.toLowerCase().includes(q)) {
        const photoPath = typeof n.data?.photoPath === 'string' ? n.data.photoPath : undefined
        all.push({ id: n.id, name, type: n.type, photoPath })
      }
    }

    all.sort((a, b) => {
      const pa = typePriority(a.type)
      const pb = typePriority(b.type)
      if (pa !== pb) return pa - pb
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })
    return all.slice(0, 8)
  }, [nodes, searchQuery])


  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
    setPendingNodePosition(null)
    // Side-panel slots are mutually exclusive
    setSelectedNode(null)
    setSelectedEdge(null)
  }

  const handleDockDragStart = useCallback(
    (kind: 'person' | 'place' | 'group') => (e: ReactDragEvent<HTMLButtonElement>) => {
      e.dataTransfer.setData(DOCK_NODE_DND_TYPE, kind)
      e.dataTransfer.effectAllowed = 'copy'
    },
    [],
  )

  const handleDropAtFlowPosition = useCallback(
    (kind: string, point: XY) => {
      if (addGroupPlacementRef.current.status === 'picking') {
        addGroupPlacementRef.current = { status: 'idle' }
        setAddGroupPlacement({ status: 'idle' })
      }

      // Side-panel slots are mutually exclusive — close any open node/edge detail.
      setSelectedNode(null)
      setSelectedEdge(null)

      if (kind === 'group') {
        const w = GROUP_NODE_DEFAULT_SIZE.width
        const h = GROUP_NODE_DEFAULT_SIZE.height
        setOpenPanel(null)
        setPendingNodePosition(null)
        setPendingGroupRect({
          x: point.x - w / 2,
          y: point.y - h / 2,
          width: w,
          height: h,
        })
        return
      }

      if (kind === 'person' || kind === 'place') {
        setPendingGroupRect(null)
        setPendingNodePosition(point)
        setOpenPanel(kind === 'person' ? 'addPerson' : 'addPlace')
      }
    },
    [],
  )

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'anchor') return
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

    setOpenPanel(null)
    setPendingNodePosition(null)
    setSelectedEdge(null)

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

    setOpenPanel(null)
    setPendingNodePosition(null)
    setSelectedNode(null)

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
      <section className={styles.statusFrame}>
        <h1>Graph</h1>
        <p>Sign in to view your graph.</p>
        <Link to="/">Go to Home</Link>
      </section>
    )
  }

  // Loading state
  if (loading) {
    return (
      <section className={styles.statusFrame}>
        <h1>Graph</h1>
        <p>Loading your relationship graph…</p>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section className={styles.statusFrame}>
        <h1>Graph</h1>
        <p className="text-error">{error}</p>
      </section>
    )
  }

  const handleAddNodeSuccess = async () => {
    await flushPendingEdges()
    await loadGraph({ skipLoading: true })
  }

  const isSidePanelOpen =
    openPanel === 'addPerson' ||
    openPanel === 'addPlace' ||
    selectedNode != null ||
    selectedEdge != null

  // Render the graph
  return (
    <section className={styles.fullBleedRoot} aria-label="Relationship graph">
      <h1 className="sr-only">Relationship graph</h1>

      <div className={clsx(styles.canvasContainer, isSidePanelOpen && styles.canvasContainerPanelOpen)}>
        <div className={styles.flowFill}>
          <DefaultFlow
            ref={flowRef}
            key={`${user.uid}-${flowKey}`}
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onPaneFlowClick={addGroupPlacement.status === 'picking' ? handlePaneFlowClick : undefined}
            groupPlacementPanMode={addGroupPlacement.status === 'picking'}
            defaultViewport={initialViewport}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onConnectPersist={handleConnectPersist}
            onDropAtFlowPosition={handleDropAtFlowPosition}
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

        {addGroupPlacement.status === 'picking' ? (
          <p className={styles.hintFloat}>
            {addGroupPlacement.phase === 1
              ? 'Click the top-left corner of the new group on the graph, then the bottom-right. Pan with middle or right mouse drag, or the scroll wheel. Press Esc to cancel.'
              : 'Now click the bottom-right corner. Esc to cancel.'}
          </p>
        ) : null}

        {syncEdgeError ? (
          <div className={styles.bannerFloat}>
            <p className={clsx('text-error', styles.bannerFloatError)}>{syncEdgeError}</p>
            <button
              type="button"
              className={clsx('btn-ghost', styles.bannerFloatDismiss)}
              onClick={() => setSyncEdgeError(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className={styles.filterRow} role="group" aria-label="Toggle node types">
          <button
            type="button"
            onClick={() => setVisibleTypes((v) => ({ ...v, person: !v.person }))}
            aria-pressed={visibleTypes.person}
            className={clsx(styles.filterChip, visibleTypes.person && styles.filterChipActive, visibleTypes.person && styles.filterChipPerson)}
          >
            <span className={styles.filterChipDot} style={{ backgroundColor: 'var(--color-node-person-border)' }} aria-hidden="true" />
            People
          </button>
          <button
            type="button"
            onClick={() => setVisibleTypes((v) => ({ ...v, place: !v.place }))}
            aria-pressed={visibleTypes.place}
            className={clsx(styles.filterChip, visibleTypes.place && styles.filterChipActive, visibleTypes.place && styles.filterChipPlace)}
          >
            <span className={styles.filterChipDot} style={{ backgroundColor: 'var(--color-node-place-border)' }} aria-hidden="true" />
            Places
          </button>
          <button
            type="button"
            onClick={() => setVisibleTypes((v) => ({ ...v, group: !v.group }))}
            aria-pressed={visibleTypes.group}
            className={clsx(styles.filterChip, visibleTypes.group && styles.filterChipActive, visibleTypes.group && styles.filterChipGroup)}
          >
            <span className={styles.filterChipDot} style={{ backgroundColor: 'var(--color-border-strong)' }} aria-hidden="true" />
            Groups
          </button>
        </div>

        <div className={styles.searchWrap}>
          <div className={styles.searchInputWrap}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a person or place…"
              aria-label="Search nodes by name"
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>
          {searchQuery ? (
            <ul className={styles.searchResults} role="listbox">
              {searchResults.length === 0 ? (
                <li className={styles.searchEmpty}>No matches</li>
              ) : (
                searchResults.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={styles.searchResultItem}
                      onClick={() => {
                        flowRef.current?.focusNode(r.id)
                        setSearchQuery('')
                      }}
                    >
                      <SearchResultThumb photoPath={r.photoPath} />
                      <span className={styles.searchResultName}>{r.name}</span>
                      <span className={styles.searchResultType}>{r.type}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        <div className={styles.dock} role="toolbar" aria-label="Graph actions">
          <button
            type="button"
            draggable
            onDragStart={handleDockDragStart('person')}
            onClick={() => togglePanel('addPerson')}
            aria-label="Add a person. Click to place at default position, or drag onto the canvas to choose a spot."
            className={clsx(styles.dockItem, styles.dockItemDraggable, openPanel === 'addPerson' && styles.dockItemActive)}
          >
            <span className={clsx(styles.dockIcon, styles.dockIconPerson)} aria-hidden="true">+</span>
            <span className={styles.dockLabel}>Person</span>
          </button>

          <button
            type="button"
            draggable
            onDragStart={handleDockDragStart('place')}
            onClick={() => togglePanel('addPlace')}
            aria-label="Add a place. Click to place at default position, or drag onto the canvas to choose a spot."
            className={clsx(styles.dockItem, styles.dockItemDraggable, openPanel === 'addPlace' && styles.dockItemActive)}
          >
            <span className={clsx(styles.dockIcon, styles.dockIconPlace)} aria-hidden="true">+</span>
            <span className={styles.dockLabel}>Place</span>
          </button>

          <button
            type="button"
            draggable
            onDragStart={handleDockDragStart('group')}
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
            aria-label={addGroupPlacement.status === 'picking' ? 'Cancel group placement' : 'Add a group. Click to draw a region, or drag onto the canvas to drop a default-sized group.'}
            className={clsx(styles.dockItem, styles.dockItemDraggable, addGroupPlacement.status === 'picking' && styles.dockItemActive)}
          >
            <span className={clsx(styles.dockIcon, styles.dockIconGroup)} aria-hidden="true">+</span>
            <span className={styles.dockLabel}>Group</span>
          </button>

          <span className={styles.dockDivider} aria-hidden="true" />

          <button
            type="button"
            onClick={() => togglePanel('addConnection')}
            aria-label="Link two nodes"
            className={clsx(styles.dockItem, openPanel === 'addConnection' && styles.dockItemActive)}
          >
            <span className={clsx(styles.dockIcon, styles.dockIconLink)} aria-hidden="true">↔</span>
            <span className={styles.dockLabel}>Link</span>
          </button>
        </div>

        {(openPanel === 'addPerson' || openPanel === 'addPlace') && (
          <AddNodePanel
            key={openPanel}
            userId={user.uid}
            pickableNodes={pickableNodes}
            initialType={openPanel === 'addPerson' ? 'person' : 'place'}
            position={pendingNodePosition ?? undefined}
            onClose={() => {
              setOpenPanel(null)
              setPendingNodePosition(null)
            }}
            onSuccess={() => {
              setPendingNodePosition(null)
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
      </div>

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
    </section>
  )
}

export default Graph
