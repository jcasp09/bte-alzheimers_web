import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type DragEvent as ReactDragEvent,
  type MouseEvent,
  type RefObject,
} from 'react'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
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
import { nodeTypes } from '../nodes'
import { getMotionMode } from '../../services/motion'
import { useThemeColor } from '../../shared/hooks/useThemeColor'

import {
  DOCK_NODE_DND_TYPE,
  GRAPH_TRANSLATE_EXTENT,
  type DefaultFlowHandle,
  type XY,
} from '../model/flowConstants'

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
  onDropAtFlowPosition?: (kind: string, point: XY) => void
  showMiniMap?: boolean
}

function PaneFlowClickBridge({
  invokerRef,
  onPaneFlowClick,
}: {
  invokerRef: RefObject<((e: MouseEvent) => void) | null>
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

function prefersReducedMotion(): boolean {
  return getMotionMode() === 'reduce'
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

const FlowCanvas = forwardRef<DefaultFlowHandle, DefaultFlowProps>(function FlowCanvas({
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
  onDropAtFlowPosition,
  showMiniMap = true,
}: DefaultFlowProps, ref) {
  const { screenToFlowPosition } = useReactFlow()
  const [internalNodes, , onInternalNodesChange] = useNodesState(initialNodes)
  const [internalEdges, setInternalEdges, onInternalEdgesChange] = useEdgesState(initialEdges)
  const viewportRef = useRef<Viewport | null>(null)
  const nodesRef = useRef<Node[]>(initialNodes)
  const paneClickInvokerRef = useRef<((e: MouseEvent) => void) | null>(null)

  const reactFlowApi = useReactFlow()
  useImperativeHandle(ref, () => ({
    focusNode: (id: string) => {
      const n = reactFlowApi.getNode(id)
      if (!n || !n.position) return
      const measured = (n as { measured?: { width?: number; height?: number } }).measured
      const w = measured?.width ?? n.width ?? 200
      const h = measured?.height ?? n.height ?? 100
      const duration = prefersReducedMotion() ? 0 : 400
      reactFlowApi.setCenter(n.position.x + w / 2, n.position.y + h / 2, { duration, zoom: 1.4 })
    },
  }), [reactFlowApi])

  const gridColor = useThemeColor('--color-grid-dot')
  const personColor = useThemeColor('--color-node-person-border')
  const placeColor = useThemeColor('--color-node-place-border')
  const groupColor = useThemeColor('--color-border-strong')
  const memoryColor = useThemeColor('--color-node-memory-border')
  const fallbackColor = useThemeColor('--color-text-muted')

  const miniMapNodeColor = useCallback((node: Node) => {
    if (node.type === 'anchor') return 'transparent'
    if (node.type === 'person') return personColor
    if (node.type === 'place') return placeColor
    if (node.type === 'group') return groupColor
    if (node.type === 'memoryBucket') return memoryColor
    return fallbackColor
  }, [personColor, placeColor, groupColor, memoryColor, fallbackColor])

  const flowWidth = useStore((s) => s.width)
  const flowHeight = useStore((s) => s.height)

  const onMinimapClick = useCallback(
    (_event: unknown, point: { x: number; y: number }) => {
      const { x: tx, y: ty, zoom } = reactFlowApi.getViewport()
      if (zoom <= 0 || flowWidth <= 0 || flowHeight <= 0) return
      const left = -tx / zoom
      const top = -ty / zoom
      const right = left + flowWidth / zoom
      const bottom = top + flowHeight / zoom
      const inside =
        point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
      if (inside) return
      const duration = prefersReducedMotion() ? 0 : 350
      reactFlowApi.setCenter(point.x, point.y, { duration, zoom })
    },
    [reactFlowApi, flowWidth, flowHeight],
  )

  const minimapStyle = { width: 180, height: 180 }

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

  const handleDragOver = useCallback((e: ReactDragEvent) => {
    if (!onDropAtFlowPosition || !Array.from(e.dataTransfer.types).includes(DOCK_NODE_DND_TYPE))
      return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [onDropAtFlowPosition])

  const handleDrop = useCallback((e: ReactDragEvent) => {
    if (!onDropAtFlowPosition)
      return

    const kind = e.dataTransfer.getData(DOCK_NODE_DND_TYPE)
    if (!kind)
      return

    e.preventDefault()
    const point = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    onDropAtFlowPosition(kind, point)
  }, [onDropAtFlowPosition, screenToFlowPosition])

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
      onDragOver={onDropAtFlowPosition ? handleDragOver : undefined}
      onDrop={onDropAtFlowPosition ? handleDrop : undefined}
      panOnDrag={groupPlacementPanMode ? [1, 2] : true}
      translateExtent={GRAPH_TRANSLATE_EXTENT}
      nodeExtent={GRAPH_TRANSLATE_EXTENT}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      defaultViewport={defaultViewport}
      proOptions={{ hideAttribution: true }}
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
        color={gridColor}
        variant={BackgroundVariant.Cross}
      />
      {showMiniMap ? (
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          onClick={onMinimapClick}
          nodeColor={miniMapNodeColor}
          nodeStrokeColor={miniMapNodeColor}
          nodeStrokeWidth={2}
          style={minimapStyle}
        />
      ) : null}
    </ReactFlow>
  )
})

export const DefaultFlow = forwardRef<DefaultFlowHandle, DefaultFlowProps>(function DefaultFlow(props, ref) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} ref={ref} />
    </ReactFlowProvider>
  )
})
