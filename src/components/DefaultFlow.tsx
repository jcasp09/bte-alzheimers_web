import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type MutableRefObject,
} from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import type {
  Connection,
  Edge,
  EdgeMouseHandler,
  Node,
  NodeMouseHandler,
  OnEdgesChange,
  OnNodesChange,
  Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from '../graph/nodeTypes'

type XY = { x: number; y: number }

type DefaultFlowProps = {
  nodes: Node[]
  edges: Edge[]
  /** When provided, the parent owns node state (layout + reparent). */
  onNodesChange?: OnNodesChange
  /** When provided with `edges`, the parent owns edge state (smooth deferred saves). */
  onEdgesChange?: OnEdgesChange
  onNodeDragStop?: (event: MouseEvent, node: Node) => void
  /** Left-clicks on the empty pane, in flow coordinates (e.g. two-click group placement). */
  onPaneFlowClick?: (point: XY) => void
  /** When true, left-drag does not pan so pane clicks stay precise; middle/right still pan. */
  groupPlacementPanMode?: boolean
  onSavePositions?: (nodes: Node[]) => void
  onSaveViewport?: (viewport: Viewport) => void
  defaultViewport?: Viewport
  onNodeClick?: NodeMouseHandler
  onEdgeClick?: EdgeMouseHandler
  /** Parent queues the connection locally; do not call addEdge here. */
  onConnectPersist?: (connection: Connection) => void
}

function PaneFlowClickBridge({
  invokerRef,
  onPaneFlowClick,
}: {
  invokerRef: MutableRefObject<((e: MouseEvent) => void) | null>
  onPaneFlowClick: (point: XY) => void
}) {
  const { screenToFlowPosition } = useReactFlow()
  useLayoutEffect(() => {
    invokerRef.current = (e: MouseEvent) => {
      onPaneFlowClick(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
    }
    return () => {
      invokerRef.current = null
    }
  }, [invokerRef, onPaneFlowClick, screenToFlowPosition])
  return null
}

function FlowCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: onNodesChangeFromParent,
  onEdgesChange: onEdgesChangeFromParent,
  onNodeDragStop,
  onPaneFlowClick,
  groupPlacementPanMode,
  onSavePositions,
  onSaveViewport,
  defaultViewport,
  onNodeClick,
  onEdgeClick,
  onConnectPersist,
}: DefaultFlowProps) {
  const [internalNodes, , onInternalNodesChange] = useNodesState(initialNodes)
  const [internalEdges, setInternalEdges, onInternalEdgesChange] = useEdgesState(initialEdges)
  const viewportRef = useRef<Viewport | null>(null)
  const nodesRef = useRef<Node[]>(initialNodes)
  const paneClickInvokerRef = useRef<((e: MouseEvent) => void) | null>(null)

  const controlledNodes = onNodesChangeFromParent != null
  const controlledEdges = onEdgesChangeFromParent != null

  const nodes = controlledNodes ? initialNodes : internalNodes
  const onNodesChange = controlledNodes ? onNodesChangeFromParent : onInternalNodesChange

  const edges = controlledEdges ? initialEdges : internalEdges
  const onEdgesChange = controlledEdges ? onEdgesChangeFromParent : onInternalEdgesChange

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (onConnectPersist) {
        onConnectPersist(connection)
        return
      }
      setInternalEdges((eds) => addEdge(connection, eds))
    },
    [onConnectPersist, setInternalEdges],
  )

  const handlePaneClick = useCallback((e: MouseEvent) => {
    paneClickInvokerRef.current?.(e)
  }, [])

  useEffect(() => {
    return () => {
      if (onSavePositions) {
        onSavePositions(nodesRef.current)
      }
      if (onSaveViewport && viewportRef.current) {
        onSaveViewport(viewportRef.current)
      }
    }
  }, [onSavePositions, onSaveViewport])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDragStop={onNodeDragStop}
      onPaneClick={onPaneFlowClick ? handlePaneClick : undefined}
      panOnDrag={groupPlacementPanMode ? [1, 2] : true}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      defaultViewport={defaultViewport}
      onMoveEnd={(_, viewport) => {
        viewportRef.current = viewport
      }}
      fitView={defaultViewport == null}
    >
      {onPaneFlowClick ? (
        <PaneFlowClickBridge invokerRef={paneClickInvokerRef} onPaneFlowClick={onPaneFlowClick} />
      ) : null}
      <Background
        id="1"
        gap={25}
        color="#f1f1f1"
        variant={BackgroundVariant.Cross}
      />
      <Controls />
    </ReactFlow>
  )
}

export function DefaultFlow(props: DefaultFlowProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  )
}