import { useCallback, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import type { Connection, Edge, Node, OnEdgesChange, OnNodesChange } from '@xyflow/react'
import { useAuth } from '../../auth/AuthContext'
import { DefaultFlow } from '../../graph/components/DefaultFlow'
import {
  DOCK_NODE_DND_TYPE,
  type DefaultFlowHandle,
  type Layer,
  type XY,
} from '../../graph/model/flowConstants'
import styles from './Graph.module.css'
import { updateEdgeLabel } from '../../graph/data/edges'
import { saveNodePositions } from '../../graph/data/nodes'
import { saveGraphViewport } from '../../graph/data/viewport'
import { GRAPH_IDS } from '../../graph/model/types'
import type { PickableNode } from '../../graph/model/types'
import { coerceRingTier, defaultVisibleRings, inferRingTier, type RingTier } from '../../graph/model/rings'
import { memoryIdFromBubbleNodeId } from '../../graph/model/ringLayout'
import { isLocalPendingEdgeId, useDeferredEdgePersistence } from '../../graph/hooks/useDeferredEdgePersistence'
import {
  SYNTH_EDGE_PREFIX,
  getMemoryMillis,
  type MemoryBrushRange,
  type MemorySelection,
} from '../../memories/model/memoryLayer'
import { MemoryTimeline } from '../../memories/components/MemoryTimeline'
import timelineStyles from '../../memories/components/MemoryTimeline.module.css'
import { AddNodePanel } from '../../graph/components/modals/AddNodeModal.tsx'
import { AddConnectionModal } from '../../graph/components/modals/AddConnectionModal.tsx'
import { AddMemoryModal } from '../../graph/components/modals/AddMemoryModal.tsx'
import { AddTaskPanel } from '../../graph/components/modals/AddTaskModal.tsx'
import { NodeInfoModal, type UpcomingTaskSummary } from '../../graph/components/modals/NodeInfoModal.tsx'
import { TaskInfoPanel } from '../../graph/components/modals/TaskInfoModal.tsx'
import { EdgeInfoModal } from '../../graph/components/modals/EdgeInfoModal.tsx'
import { SelfNodeInfoModal } from '../../graph/components/modals/SelfNodeInfoModal.tsx'
import { MemoryInfoModal } from '../../memories/components/MemoryInfoModal.tsx'
import { useGraphData } from './hooks/useGraphData'
import { useDisplayElements } from './hooks/useDisplayElements'
import { useNodeSearch } from './hooks/useNodeSearch'
import { useGraphSidePanel } from './hooks/useGraphSidePanel'
import { SyncErrorBanner } from './components/SyncErrorBanner'
import { ErrorToast } from '../../shared/ui/ErrorToast'
import { GraphSearch } from './components/GraphSearch'
import { GraphDock } from './components/GraphDock'
import { GraphLeftSidebar } from './components/GraphLeftSidebar'
import { readSidebarCollapsedPref } from './components/graphLeftSidebarPrefs'

function Graph() {
  const { user, profile } = useAuth()
  const {
    nodes, setNodes,
    edges, setEdges,
    memories,
    tasks,
    initialViewport,
    flowKey,
    loading,
    error,
    loadGraph,
    reloadTasks,
  } = useGraphData(user?.uid)
  const [memorySelection, setMemorySelection] = useState<MemorySelection | null>(null)
  const [memoryBrushRange, setMemoryBrushRange] = useState<MemoryBrushRange | null>(null)
  const [syncEdgeError, setSyncEdgeError] = useState<string | null>(null)
  const [duplicateConnection, setDuplicateConnection] = useState<{ text: string; nonce: number } | null>(null)
  const [canvasLinkMode, setCanvasLinkMode] = useState<{
    eligibleTypes: ReadonlySet<string>
    selectedIds: ReadonlySet<string>
    onToggle: (nodeId: string) => void
  } | null>(null)
  const {
    openPanel,
    selectedNode,
    selectedEdge,
    memoryInfoId,
    taskInfoId,
    pendingNodePosition,
    isSidePanelOpen,
    isSelfInfoOpen,
    close: closeSidePanel,
    openAddPanel,
    openNodeInfo,
    openEdgeInfo,
    openMemoryInfo,
    openTaskInfo,
    openSelfInfo,
    togglePanel,
  } = useGraphSidePanel()
  const flowRef = useRef<DefaultFlowHandle>(null)
  const currentLayer = 'relationships' as Layer
  const [visibleRings, setVisibleRings] = useState<Set<RingTier>>(() => defaultVisibleRings())
  const [showAllEdges, setShowAllEdges] = useState(false)
  const [memoryLensOn, setMemoryLensOn] = useState(false)
  const [memoryLensRange, setMemoryLensRange] = useState<MemoryBrushRange | null>(null)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState<boolean>(() =>
    readSidebarCollapsedPref(),
  )
  const [minimapHost, setMinimapHost] = useState<HTMLDivElement | null>(null)
  const minimapHostRef = useCallback((node: HTMLDivElement | null) => {
    setMinimapHost(node)
  }, [])
  const {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    searchInputRef,
    searchResults,
  } = useNodeSearch(nodes, memories, currentLayer)

  const onEdgesChange: OnEdgesChange = (changes) => {
    setEdges((eds) => {
      const known = new Set(eds.map((e) => e.id))
      const relevant = changes.filter((c) => {
        if (c.type === 'add' || c.type === 'replace')
          return true
        const id = (c as { id?: string }).id
        return id != null && known.has(id)
      })
      return relevant.length === 0 ? eds : applyEdgeChanges(relevant, eds)
    })
  }

  const onNodesChange: OnNodesChange = (changes) => {
    setNodes((nds) => {
      const known = new Set(nds.map((n) => n.id))
      const relevant = changes.filter((c) => {
        if (c.type === 'add' || c.type === 'replace')
          return true
        const id = (c as { id?: string }).id
        return id != null && known.has(id)
      })
      return relevant.length === 0 ? nds : applyNodeChanges(relevant, nds)
    })
  }

  const onNodeDragStop = (_e: MouseEvent, node: Node) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, ...node, position: node.position } : n)),
    )
  }

  const handlePaneClick = () => {
    if (canvasLinkMode) return
    if (currentLayer === 'memories') {
      setMemorySelection(null)
      setMemoryBrushRange(null)
    }
    if (isSidePanelOpen) {
      closeSidePanel()
    }
  }

  const {
    queueConnection,
    updatePendingEdgeLabel,
    flushPendingEdges,
    removePendingEdge,
  } = useDeferredEdgePersistence(user?.uid, GRAPH_IDS.context, setEdges, setSyncEdgeError)

  const tryQueueConnection = useCallback(
    (connection: Connection, opts?: { label?: string }) => {
      const source = connection.source
      const target = connection.target
      if (!source || !target || source === target)
        return null

      const dup = edges.some(
        (e) =>
          (e.source === source && e.target === target) ||
          (e.source === target && e.target === source),
      )
      if (dup) {
        const nameOf = (id: string): string => {
          const found = nodes.find((n) => n.id === id)
          const raw = found?.data?.name
          return typeof raw === 'string' ? raw.trim() : ''
        }
        const sName = nameOf(source)
        const tName = nameOf(target)
        const label = sName && tName ? `${sName} and ${tName}` : 'These nodes'
        setDuplicateConnection({ text: `${label} are already connected.`, nonce: Date.now() })
        return null
      }
      return queueConnection(connection, opts)
    },
    [edges, nodes, queueConnection],
  )

  const linkModeForDisplay = useMemo(
    () =>
      canvasLinkMode
        ? { eligibleTypes: canvasLinkMode.eligibleTypes, selectedIds: canvasLinkMode.selectedIds }
        : null,
    [canvasLinkMode],
  )

  const {
    contextToMemories,
    displayNodes,
    displayEdges,
    canvasExtent,
    panExtent,
  } = useDisplayElements({
    nodes, edges, memories, tasks,
    currentLayer, visibleRings,
    showAllEdges,
    memoryLensOn, memoryLensRange,
    memorySelection, memoryBrushRange,
    relationshipSelectedNodeId: currentLayer === 'memories' ? null : (selectedNode?.id ?? null),
    canvasLinkMode: linkModeForDisplay,
  })

  const memoryPeoplePickerItems = useMemo(() => {
    const out: { id: string; name: string; photoPath?: string; photoUpdatedAt?: string }[] = []
    for (const n of nodes) {
      if (n.type !== 'person') continue
      const name = typeof n.data?.name === 'string' ? n.data.name : ''
      if (!name) continue
      const photoPath = typeof n.data?.photoPath === 'string' ? n.data.photoPath : undefined
      const photoUpdatedAt = typeof n.data?.photoUpdatedAt === 'string' ? n.data.photoUpdatedAt : undefined
      out.push({ id: n.id, name, photoPath, photoUpdatedAt })
    }
    return out
  }, [nodes])

  const memoryPlacesPickerItems = useMemo(() => {
    const out: { id: string; name: string; photoPath?: string }[] = []
    for (const n of nodes) {
      if (n.type !== 'place') continue
      const name = typeof n.data?.name === 'string' ? n.data.name : ''
      if (!name) continue
      const photoPath = typeof n.data?.photoPath === 'string' ? n.data.photoPath : undefined
      out.push({ id: n.id, name, photoPath })
    }
    return out
  }, [nodes])

  const pickableNodes = useMemo<PickableNode[]>(() => {
    const out: PickableNode[] = []
    for (const n of nodes) {
      if (n.type === 'self') {
        const firstName = profile?.firstName?.trim() ?? ''
        const lastName = profile?.lastName?.trim() ?? ''
        const fullName = [firstName, lastName].filter((s) => s.length > 0).join(' ')
        const name = fullName || user?.displayName || 'You'
        const photoPath = profile?.photoURL ?? undefined
        out.push({ id: n.id, type: 'self', name, photoPath })
        continue
      }

      if (n.type !== 'person' && n.type !== 'place')
        continue

      const name = typeof n.data?.name === 'string' ? n.data.name : ''
      if (!name)
        continue

      const photoPath = typeof n.data?.photoPath === 'string' ? n.data.photoPath : undefined
      out.push({ id: n.id, type: n.type, name, photoPath })
    }
    return out
  }, [nodes, profile, user])

  const selectedNodeRingTier = useMemo<RingTier | null>(() => {
    if (!selectedNode) return null
    return coerceRingTier(selectedNode.ringTier ?? null)
  }, [selectedNode])

  const selectedNodeInferredRingTier = useMemo<RingTier | null>(() => {
    if (!selectedNode) return null
    const n = nodes.find((x) => x.id === selectedNode.id)
    if (!n) return null
    return inferRingTier(
      {
        id: n.id,
        type: typeof n.type === 'string' ? n.type : '',
        relationship: typeof n.data?.relationship === 'string' ? n.data.relationship : null,
        ringTier: null,
      },
      edges,
    )
  }, [selectedNode, nodes, edges])

  const connectedForSelectedNode = useMemo(() => {
    if (!selectedNode) return null
    const id = selectedNode.id
    const neighbourIds = new Set<string>()
    for (const e of edges) {
      if (e.source === id) neighbourIds.add(e.target)
      else if (e.target === id) neighbourIds.add(e.source)
    }
    const people: { id: string; name: string; photoPath?: string }[] = []
    const places: { id: string; name: string; photoPath?: string }[] = []
    for (const n of nodes) {
      if (!neighbourIds.has(n.id)) continue
      if (n.type !== 'person' && n.type !== 'place') continue
      const name = typeof n.data?.name === 'string' ? n.data.name : ''
      if (!name) continue
      const photoPath = typeof n.data?.photoPath === 'string' ? n.data.photoPath : undefined
      const item = { id: n.id, name, photoPath }
      if (n.type === 'person') people.push(item)
      else places.push(item)
    }
    const linkedMemories = memories
      .filter((m) => m.personNodeIds.includes(id) || m.placeNodeIds.includes(id))
      .map((m) => ({
        id: m.id,
        name: m.title || 'Memory',
        photoPath: m.photoPaths[0],
      }))
    return { people, places, memories: linkedMemories }
  }, [selectedNode, edges, nodes, memories])

  const upcomingTasksForSelectedNode = useMemo<UpcomingTaskSummary[]>(() => {
    if (!selectedNode) return []
    const id = selectedNode.id
    return tasks
      .filter((t) => Array.isArray(t.linkedNodeIds) && t.linkedNodeIds.includes(id))
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        title: (typeof t.title === 'string' && t.title.trim().length > 0)
          ? t.title
          : (t.name ?? 'Untitled task'),
        startAt: t.startAt,
      }))
  }, [selectedNode, tasks])

  const selectedTask = useMemo(
    () => (taskInfoId ? tasks.find((t) => t.id === taskInfoId) ?? null : null),
    [taskInfoId, tasks],
  )

  const handleDropAtFlowPosition = (kind: string, point: XY) => {
    if (kind === 'person' || kind === 'place') {
      openAddPanel(kind === 'person' ? 'addPerson' : 'addPlace', point)
      return
    }

    if (kind === 'memory') {
      openAddPanel('addMemory')
    }
  }

  const handleNodeClick = (_: MouseEvent, node: Node) => {
    if (node.type === 'anchor') return
    if (canvasLinkMode) {
      if (typeof node.type === 'string' && canvasLinkMode.eligibleTypes.has(node.type)) {
        canvasLinkMode.onToggle(node.id)
      }
      return
    }

    if (node.type === 'self') {
      openSelfInfo()
      return
    }

    if (node.type === 'memoryBubble') {
      const memoryId = memoryIdFromBubbleNodeId(node.id)
      if (memoryId) {
        openMemoryInfo(memoryId)
        setMemorySelection({ kind: 'memory', id: memoryId })
      }
      return
    }

    if (currentLayer === 'memories') {
      if (node.type === 'memory') {
        setMemorySelection({ kind: 'memory', id: node.id })
        openMemoryInfo(node.id)
        return
      }
      if (node.type === 'person' || node.type === 'place') {
        setMemorySelection({ kind: 'context', id: node.id })
      } else {
        return
      }
    }

    const name = typeof node.data.name === 'string' ? node.data.name : ''
    const relationship = typeof node.data.relationship === 'string' ? node.data.relationship : ''
    const email = typeof node.data.email === 'string' ? node.data.email : ''
    const phone = typeof node.data.phone === 'string' ? node.data.phone : ''
    const address = typeof node.data.address === 'string' ? node.data.address : ''
    const photoPath = typeof node.data.photoPath === 'string' ? node.data.photoPath : ''
    const photoUpdatedAt = typeof node.data.photoUpdatedAt === 'string' ? node.data.photoUpdatedAt : undefined
    const ringTier = typeof node.data.ringTier === 'number' && Number.isFinite(node.data.ringTier) ? node.data.ringTier : null
    const w = node.data.width
    const h = node.data.height

    openNodeInfo({
      id: node.id,
      name,
      type: node.type ?? 'unknown',
      relationship,
      email,
      phone,
      address,
      photoPath,
      photoUpdatedAt,
      ringTier,
      width: typeof w === 'number' && Number.isFinite(w) ? w : undefined,
      height: typeof h === 'number' && Number.isFinite(h) ? h : undefined,
    })
  }

  const handleEdgeClick = (_: MouseEvent, edge: Edge) => {
    if (edge.id.startsWith(SYNTH_EDGE_PREFIX))
      return

    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)
    const sourceName = (sourceNode?.data?.name as string | undefined) ?? edge.source
    const targetName = (targetNode?.data?.name as string | undefined) ?? edge.target
    const sourcePhotoPath = typeof sourceNode?.data?.photoPath === 'string'
      ? (sourceNode.data.photoPath as string)
      : undefined
    const targetPhotoPath = typeof targetNode?.data?.photoPath === 'string'
      ? (targetNode.data.photoPath as string)
      : undefined
    const rawLabel = edge.label
    const label = typeof rawLabel === 'string' ? rawLabel : typeof rawLabel === 'number' ? String(rawLabel) : ''

    openEdgeInfo({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      sourceName,
      targetName,
      sourcePhotoPath,
      targetPhotoPath,
      label,
    })
  }

  const handleSaveEdgeLabel = async (edgeId: string, label: string) => {
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
  }

  const handleConnectPersist = (connection: Connection) => {
    if (!user?.uid) return
    tryQueueConnection(connection)
  }

  if (!user) {
    return (
      <section className={styles.statusFrame}>
        <h1>Graph</h1>
        <p>Sign in to view your graph.</p>
        <Link to="/">Go to Home</Link>
      </section>
    )
  }

  if (loading) {
    return (
      <section className={styles.statusFrame}>
        <h1>Graph</h1>
        <p>Loading your relationship graph...</p>
      </section>
    )
  }

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


  const sectionLabel = currentLayer === 'memories' ? 'Memories graph' : 'Relationship graph'

  const selectedMemoryId = memorySelection?.kind === 'memory' ? memorySelection.id : null
  const highlightedMemoryIds = memorySelection?.kind === 'context' ? (contextToMemories.get(memorySelection.id) ?? new Set<string>()) : undefined
  const selectedMemory = memoryInfoId
    ? memories.find((m) => m.id === memoryInfoId) ?? null
    : null

  const focusConnectedNode = (nodeId: string) => {
    const n = nodes.find((x) => x.id === nodeId)
    if (!n || (n.type !== 'person' && n.type !== 'place')) return
    const data = n.data ?? {}
    const name = typeof data.name === 'string' ? data.name : ''
    const relationship = typeof data.relationship === 'string' ? data.relationship : ''
    const email = typeof data.email === 'string' ? data.email : ''
    const phone = typeof data.phone === 'string' ? data.phone : ''
    const address = typeof data.address === 'string' ? data.address : ''
    const photoPath = typeof data.photoPath === 'string' ? data.photoPath : ''
    const photoUpdatedAt = typeof data.photoUpdatedAt === 'string' ? data.photoUpdatedAt : undefined
    const ringTier = typeof data.ringTier === 'number' && Number.isFinite(data.ringTier) ? data.ringTier : null
    const w = data.width
    const h = data.height
    openNodeInfo({
      id: n.id,
      name,
      type: n.type ?? 'unknown',
      relationship,
      email,
      phone,
      address,
      photoPath,
      photoUpdatedAt,
      ringTier,
      width: typeof w === 'number' && Number.isFinite(w) ? w : undefined,
      height: typeof h === 'number' && Number.isFinite(h) ? h : undefined,
    })
    window.setTimeout(() => flowRef.current?.focusNode(n.id), 0)
  }

  const focusConnectedMemory = (memoryId: string) => {
    setMemorySelection({ kind: 'memory', id: memoryId })
    openMemoryInfo(memoryId)
    window.setTimeout(() => flowRef.current?.focusNode(memoryId), 0)
  }

  return (
    <section className={styles.fullBleedRoot} aria-label={sectionLabel}>
      <h1 className="sr-only">{sectionLabel}</h1>

      <div
        className={clsx(styles.canvasContainer, isSidePanelOpen && styles.canvasContainerPanelOpen, currentLayer === 'memories' && styles.canvasContainerLayerMemories)}
        style={{'--left-rail-width': leftSidebarCollapsed ? '72px' : '276px'} as CSSProperties}
      >
        <div className={styles.flowFill}>
          <DefaultFlow
            ref={flowRef}
            key={`${user.uid}-${flowKey}`}
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onPaneFlowClick={
              canvasLinkMode
                ? handlePaneClick
                : (isSidePanelOpen || (currentLayer === 'memories' && (memorySelection != null || memoryBrushRange != null)))
                  ? handlePaneClick
                  : undefined
            }
            defaultViewport={initialViewport}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onConnectPersist={handleConnectPersist}
            onDropAtFlowPosition={handleDropAtFlowPosition}
            showMiniMap={!leftSidebarCollapsed && minimapHost != null}
            minimapPortalTarget={minimapHost}
            canvasExtent={canvasExtent}
            panExtent={panExtent}
            onSavePositions={(updatedNodes) => {
              void saveNodePositions(
                user.uid,
                updatedNodes.map((n) => ({
                  id: n.id,
                  position: n.position,
                })),
                GRAPH_IDS.context,
              )
            }}
            onSaveViewport={(viewport) => {
              void saveGraphViewport(user.uid, viewport, GRAPH_IDS.context)
            }}
          />
        </div>

        {currentLayer === 'memories' ? (
          <MemoryTimeline
            memories={memories}
            onMemoryClick={(id) => {
              flowRef.current?.focusNode(id)
              setMemorySelection({ kind: 'memory', id })
            }}
            selectedMemoryId={selectedMemoryId}
            highlightedMemoryIds={highlightedMemoryIds}
            brushRange={memoryBrushRange}
            onBrushChange={setMemoryBrushRange}
            trailingActions={
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DOCK_NODE_DND_TYPE, 'memory')
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => togglePanel('addMemory')}
                aria-label="Add a memory. Click to open the form, or drag onto the canvas."
                className={clsx(timelineStyles.trailingAction, openPanel === 'addMemory' && timelineStyles.trailingActionActive)}
              >
                <span className={timelineStyles.trailingActionIcon} aria-hidden="true">+</span>
                <span className={timelineStyles.trailingActionLabel}>Memory</span>
              </button>
            }
          />
        ) : null}

        {currentLayer === 'relationships' && memoryLensOn ? (
          <MemoryTimeline
            memories={memories}
            onMemoryClick={(id) => openMemoryInfo(id)}
            brushRange={memoryLensRange}
            onBrushChange={setMemoryLensRange}
          />
        ) : null}

        <SyncErrorBanner message={syncEdgeError} onDismiss={() => setSyncEdgeError(null)} />

        <ErrorToast
          message={duplicateConnection?.text ?? null}
          nonce={duplicateConnection?.nonce ?? 0}
          onDismiss={() => setDuplicateConnection(null)}
          className={styles.toastBelowLayerSwitcher}
        />

        <GraphLeftSidebar
          collapsed={leftSidebarCollapsed}
          setCollapsed={setLeftSidebarCollapsed}
          visibleRings={visibleRings}
          setVisibleRings={setVisibleRings}
          showAllEdges={showAllEdges}
          setShowAllEdges={setShowAllEdges}
          memoryLensOn={memoryLensOn}
          setMemoryLensOn={setMemoryLensOn}
          minimapHostRef={minimapHostRef}
          tasks={tasks}
          pickableNodes={pickableNodes}
          onAddTask={() => openAddPanel('addTask')}
          onTaskClick={(taskId) => openTaskInfo(taskId)}
        />

        <GraphSearch
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchExpanded={searchExpanded}
          setSearchExpanded={setSearchExpanded}
          searchResults={searchResults}
          currentLayer={currentLayer}
          onSelect={(r) => {
            if (currentLayer === 'memories') {
              if (memoryBrushRange) {
                const m = memories.find((x) => x.id === r.id)
                const ms = m ? getMemoryMillis(m) : null
                const outOfBrush = ms == null || ms < memoryBrushRange.start || ms > memoryBrushRange.end
                if (outOfBrush)
                  setMemoryBrushRange(null)
              }
              setMemorySelection({ kind: 'memory', id: r.id })
            }
            window.setTimeout(() => flowRef.current?.focusNode(r.id), 0)
          }}
        />

        {!(currentLayer === 'relationships' && memoryLensOn) && (
          <GraphDock
            openPanel={openPanel}
            togglePerson={() => togglePanel('addPerson')}
            togglePlace={() => togglePanel('addPlace')}
            toggleConnection={() => togglePanel('addConnection')}
            toggleMemory={() => togglePanel('addMemory')}
          />
        )}

        {openPanel === 'addMemory' && (
          <AddMemoryModal
            userId={user.uid}
            pickableNodes={pickableNodes}
            onSetCanvasLinkMode={setCanvasLinkMode}
            onClose={closeSidePanel}
            onCreated={() => {
              void (async () => {
                await flushPendingEdges()
                await loadGraph({ skipLoading: true })
              })()
            }}
          />
        )}

        {(openPanel === 'addPerson' || openPanel === 'addPlace') && (
          <AddNodePanel
            key={openPanel}
            userId={user.uid}
            pickableNodes={pickableNodes}
            initialType={openPanel === 'addPerson' ? 'person' : 'place'}
            position={pendingNodePosition ?? undefined}
            onClose={closeSidePanel}
            onSetCanvasLinkMode={setCanvasLinkMode}
            onSuccess={() => {
              void handleAddNodeSuccess()
            }}
          />
        )}

        {selectedNode && (
          <NodeInfoModal
            key={selectedNode.id}
            userId={user.uid}
            nodeId={selectedNode.id}
            connectedPeople={connectedForSelectedNode?.people}
            connectedPlaces={connectedForSelectedNode?.places}
            connectedMemories={connectedForSelectedNode?.memories}
            upcomingTasks={upcomingTasksForSelectedNode}
            onFocusConnectedNode={focusConnectedNode}
            onFocusConnectedMemory={focusConnectedMemory}
            onFocusTask={(taskId) => openTaskInfo(taskId)}
            onSizeChanged={(w, h) => {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === selectedNode.id
                    ? { ...n, data: { ...n.data, width: w, height: h } }
                    : n,
                ),
              )
            }}
            nodeName={selectedNode.name}
            nodeType={selectedNode.type}
            nodeRelationship={selectedNode.relationship ?? ''}
            nodeEmail={selectedNode.email ?? ''}
            nodePhone={selectedNode.phone ?? ''}
            nodeAddress={selectedNode.address ?? ''}
            nodePhotoPath={selectedNode.photoPath ?? ''}
            nodePhotoUpdatedAt={selectedNode.photoUpdatedAt}
            nodeWidth={selectedNode.width}
            nodeHeight={selectedNode.height}
            nodeRingTier={selectedNodeRingTier}
            inferredRingTier={selectedNodeInferredRingTier}
            onClose={closeSidePanel}
            onSuccess={() => {
              void (async () => {
                await flushPendingEdges()
                await loadGraph({ skipLoading: true })
                closeSidePanel()
              })()
            }}
          />
        )}

        {selectedMemory && (
          <MemoryInfoModal
            userId={user.uid}
            memory={selectedMemory}
            people={memoryPeoplePickerItems}
            places={memoryPlacesPickerItems}
            onClose={closeSidePanel}
            onSaved={() => {
              void loadGraph({ skipLoading: true })
            }}
            onDeleted={() => {
              setMemorySelection(null)
              setMemoryBrushRange(null)
              void loadGraph({ skipLoading: true })
            }}
          />
        )}

        {isSelfInfoOpen && (
          <SelfNodeInfoModal onClose={closeSidePanel} />
        )}

        {selectedEdge && (
          <EdgeInfoModal
            userId={user.uid}
            edgeId={selectedEdge.id}
            sourceId={selectedEdge.sourceId}
            targetId={selectedEdge.targetId}
            sourceName={selectedEdge.sourceName}
            targetName={selectedEdge.targetName}
            sourcePhotoPath={selectedEdge.sourcePhotoPath}
            targetPhotoPath={selectedEdge.targetPhotoPath}
            edgeLabel={selectedEdge.label ?? ''}
            onClose={closeSidePanel}
            onFocusEndpoint={focusConnectedNode}
            onEdgeDeleted={(edgeId) => {
              removePendingEdge(edgeId)
              closeSidePanel()
            }}
            onSaveEdgeLabel={handleSaveEdgeLabel}
          />
        )}

        {openPanel === 'addConnection' && (
          <AddConnectionModal
            pickableNodes={pickableNodes}
            onClose={closeSidePanel}
            onQueueConnection={tryQueueConnection}
            onSetCanvasLinkMode={setCanvasLinkMode}
          />
        )}

        {openPanel === 'addTask' && (
          <AddTaskPanel
            userId={user.uid}
            pickableNodes={pickableNodes}
            onClose={closeSidePanel}
            onSetCanvasLinkMode={setCanvasLinkMode}
            onSuccess={() => {
              void reloadTasks()
            }}
          />
        )}

        {selectedTask && (
          <TaskInfoPanel
            key={selectedTask.id}
            userId={user.uid}
            task={selectedTask}
            pickableNodes={pickableNodes}
            onClose={closeSidePanel}
            onSetCanvasLinkMode={setCanvasLinkMode}
            onSaved={() => {
              void reloadTasks()
            }}
            onDeleted={() => {
              void reloadTasks()
            }}
          />
        )}
      </div>
    </section>
  )
}

export default Graph
