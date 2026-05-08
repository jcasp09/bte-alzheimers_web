import { useMemo, useRef, useState, type MouseEvent } from 'react'
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
import { GROUP_NODE_DEFAULT_SIZE } from '../../graph/model/dimensions'
import { applyReparentOnDragStop } from '../../graph/model/reparent'
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
import { AddGroupModal } from '../../graph/components/modals/AddGroupModal.tsx'
import { AddMemoryModal } from '../../graph/components/modals/AddMemoryModal.tsx'
import { NodeInfoModal } from '../../graph/components/modals/NodeInfoModal.tsx'
import { EdgeInfoModal } from '../../graph/components/modals/EdgeInfoModal.tsx'
import { MemoryInfoModal } from '../../memories/components/MemoryInfoModal.tsx'
import {
  DEFAULT_VISIBLE_TYPES,
  type VisibleTypes,
} from './lib/nodeMappers'
import { useGraphData } from './hooks/useGraphData'
import { useLayerState } from './hooks/useLayerState'
import { useGroupPlacement } from './hooks/useGroupPlacement'
import { useDisplayElements } from './hooks/useDisplayElements'
import { useNodeSearch } from './hooks/useNodeSearch'
import { useGraphSidePanel } from './hooks/useGraphSidePanel'
import { LayerSwitcher } from './components/LayerSwitcher'
import { GroupPlacementHint } from './components/GroupPlacementHint'
import { SyncErrorBanner } from './components/SyncErrorBanner'
import { MinimapToggle } from './components/MinimapToggle'
import { GraphFilterBar } from './components/GraphFilterBar'
import { GraphSearch } from './components/GraphSearch'
import { GraphDock } from './components/GraphDock'

function Graph() {
  const { user } = useAuth()
  const {
    nodes, setNodes,
    edges, setEdges,
    memories,
    initialViewport,
    flowKey,
    loading,
    error,
    loadGraph,
  } = useGraphData(user?.uid)
  const [memorySelection, setMemorySelection] = useState<MemorySelection | null>(null)
  const [memoryBrushRange, setMemoryBrushRange] = useState<MemoryBrushRange | null>(null)
  const [syncEdgeError, setSyncEdgeError] = useState<string | null>(null)
  const {
    addGroupPlacement,
    addGroupPlacementRef,
    setAddGroupPlacement,
    pendingGroupRect,
    setPendingGroupRect,
    handlePaneFlowClick,
  } = useGroupPlacement()
  const {
    openPanel,
    selectedNode,
    selectedEdge,
    memoryInfoId,
    pendingNodePosition,
    isSidePanelOpen,
    close: closeSidePanel,
    openAddPanel,
    openNodeInfo,
    openEdgeInfo,
    openMemoryInfo,
    togglePanel,
  } = useGraphSidePanel()
  const flowRef = useRef<DefaultFlowHandle>(null)
  const { currentLayer, setCurrentLayer } = useLayerState()
  const [visibleTypes, setVisibleTypes] = useState<VisibleTypes>(DEFAULT_VISIBLE_TYPES)
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [minimapExpanded, setMinimapExpanded] = useState(false)
  const {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    searchInputRef,
    searchResults,
  } = useNodeSearch(nodes, memories, currentLayer)

  // Switching layers closes any open side panel and clears search/selection.
  // Done synchronously alongside setCurrentLayer so we don’t setState in an effect.
  function changeLayer(next: Layer) {
    closeSidePanel()
    setPendingGroupRect(null)
    setAddGroupPlacement({ status: 'idle' })
    setMemorySelection(null)
    setMemoryBrushRange(null)
    setSearchQuery('')
    setCurrentLayer(next)
  }

  // Drop changes that target IDs the parent doesn't own.
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
    setNodes((nds) => {
      const merged = nds.map((n) => (n.id === node.id ? { ...n, ...node, position: node.position } : n))
      return applyReparentOnDragStop(merged, node.id)
    })
  }

  /** Pane-click handler: close any open side panel and clear memory-layer selection/brush. */
  const handlePaneClick = () => {
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

  const {
    contextToMemories,
    displayNodes,
    displayEdges,
  } = useDisplayElements({
    nodes, edges, memories,
    currentLayer, visibleTypes,
    memorySelection, memoryBrushRange,
    relationshipSelectedNodeId: currentLayer === 'memories' ? null : (selectedNode?.id ?? null),
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

  const handleDropAtFlowPosition = (kind: string, point: XY) => {
    if (addGroupPlacementRef.current.status === 'picking') {
      setAddGroupPlacement({ status: 'idle' })
    }

    if (kind === 'group') {
      const w = GROUP_NODE_DEFAULT_SIZE.width
      const h = GROUP_NODE_DEFAULT_SIZE.height
      closeSidePanel()
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
      openAddPanel(kind === 'person' ? 'addPerson' : 'addPlace', point)
      return
    }

    if (kind === 'memory') {
      // Memories don't have stored positions
      setPendingGroupRect(null)
      openAddPanel('addMemory')
    }
  }

  const handleNodeClick = (_: MouseEvent, node: Node) => {
    if (node.type === 'anchor') return
    if (addGroupPlacementRef.current.status === 'picking')
      return

    if (currentLayer === 'memories') {
      if (node.type === 'memory') {
        setMemorySelection({ kind: 'memory', id: node.id })
        openMemoryInfo(node.id)
        return
      }
      if (node.type === 'person' || node.type === 'place') {
        setMemorySelection({ kind: 'context', id: node.id })
        // fall through to open the existing NodeInfoModal below
      } else {
        // Groups in memories layer are filtered out, but be defensive.
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
    const w = node.type === 'group' ? node.width : node.data.width
    const h = node.type === 'group' ? node.height : node.data.height

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
      width: typeof w === 'number' && Number.isFinite(w) ? w : undefined,
      height: typeof h === 'number' && Number.isFinite(h) ? h : undefined,
    })
  }

  const handleEdgeClick = (_: MouseEvent, edge: Edge) => {
    if (addGroupPlacementRef.current.status === 'picking')
      return

    // Memory-layer synth edges aren't backed by Firestore
    if (edge.id.startsWith(SYNTH_EDGE_PREFIX))
      return

    const sourceName = nodes.find((n) => n.id === edge.source)?.data?.name as string ?? edge.source
    const targetName = nodes.find((n) => n.id === edge.target)?.data?.name as string ?? edge.target
    const rawLabel = edge.label
    const label = typeof rawLabel === 'string' ? rawLabel : typeof rawLabel === 'number' ? String(rawLabel) : ''

    openEdgeInfo({
      id: edge.id,
      sourceName,
      targetName,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
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
    queueConnection(connection)
  }

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


  const sectionLabel = currentLayer === 'memories' ? 'Memories graph' : 'Relationship graph'

  const selectedMemoryId = memorySelection?.kind === 'memory' ? memorySelection.id : null
  const highlightedMemoryIds = memorySelection?.kind === 'context' ? (contextToMemories.get(memorySelection.id) ?? new Set<string>()) : undefined
  const selectedMemory = memoryInfoId
    ? memories.find((m) => m.id === memoryInfoId) ?? null
    : null

  // Render the graph
  return (
    <section className={styles.fullBleedRoot} aria-label={sectionLabel}>
      <h1 className="sr-only">{sectionLabel}</h1>

      <div className={clsx(styles.canvasContainer, isSidePanelOpen && styles.canvasContainerPanelOpen, currentLayer === 'memories' && styles.canvasContainerLayerMemories)}>
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
              addGroupPlacement.status === 'picking'
                ? handlePaneFlowClick
                : (isSidePanelOpen || (currentLayer === 'memories' && (memorySelection != null || memoryBrushRange != null)))
                  ? handlePaneClick
                  : undefined
            }
            groupPlacementPanMode={addGroupPlacement.status === 'picking'}
            defaultViewport={initialViewport}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onConnectPersist={handleConnectPersist}
            onDropAtFlowPosition={handleDropAtFlowPosition}
            showMiniMap={minimapExpanded}
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

        <LayerSwitcher currentLayer={currentLayer} onChange={changeLayer} />

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

        {currentLayer === 'relationships' && (
          <GroupPlacementHint placement={addGroupPlacement} />
        )}

        <SyncErrorBanner message={syncEdgeError} onDismiss={() => setSyncEdgeError(null)} />

        <GraphFilterBar
          expanded={filterExpanded}
          setExpanded={setFilterExpanded}
          currentLayer={currentLayer}
          visibleTypes={visibleTypes}
          setVisibleTypes={setVisibleTypes}
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

        <MinimapToggle expanded={minimapExpanded} setExpanded={setMinimapExpanded} />

        <GraphDock
          openPanel={openPanel}
          togglePerson={() => togglePanel('addPerson')}
          togglePlace={() => togglePanel('addPlace')}
          toggleConnection={() => togglePanel('addConnection')}
          groupPlacement={addGroupPlacement}
          toggleGroupPlacement={() => {
            if (addGroupPlacement.status === 'picking') {
              setAddGroupPlacement({ status: 'idle' })
              setPendingGroupRect(null)
              return
            }
            setAddGroupPlacement({ status: 'picking', phase: 1 })
          }}
        />

        {openPanel === 'addMemory' && (
          <AddMemoryModal
            userId={user.uid}
            people={memoryPeoplePickerItems}
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

        {selectedEdge && (
          <EdgeInfoModal
            userId={user.uid}
            edgeId={selectedEdge.id}
            sourceName={selectedEdge.sourceName}
            targetName={selectedEdge.targetName}
            sourceHandle={selectedEdge.sourceHandle}
            targetHandle={selectedEdge.targetHandle}
            edgeLabel={selectedEdge.label ?? ''}
            onClose={closeSidePanel}
            onEdgeDeleted={(edgeId) => {
              removePendingEdge(edgeId)
              closeSidePanel()
            }}
            onSaveEdgeLabel={handleSaveEdgeLabel}
          />
        )}
      </div>

      {openPanel === 'addConnection' && (
        <AddConnectionModal
          pickableNodes={pickableNodes}
          onClose={closeSidePanel}
          onQueueConnection={queueConnection}
        />
      )}

      {pendingGroupRect && (
        <AddGroupModal
          userId={user.uid}
          draftRect={pendingGroupRect}
          onClose={() => {
            setPendingGroupRect(null)
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
