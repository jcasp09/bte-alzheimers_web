import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
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
import { getMotionMode } from '../../settings/motion'
import { useThemeColor } from '../../shared/hooks/useThemeColor'

import {
  DOCK_NODE_DND_TYPE,
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
  /** Left-clicks on the empty pane, in flow coordinates. */
  onPaneFlowClick?: (point: XY) => void
  onSavePositions?: (nodes: Node[]) => void
  onSaveViewport?: (viewport: Viewport) => void
  defaultViewport?: Viewport
  onNodeClick?: NodeMouseHandler
  onEdgeClick?: EdgeMouseHandler
  /** Parent queues the connection locally; do not call addEdge here. */
  onConnectPersist?: (connection: Connection) => void
  onDropAtFlowPosition?: (kind: string, point: XY) => void
  showMiniMap?: boolean
  minimapPortalTarget?: HTMLElement | null
  canvasExtent?: [[number, number], [number, number]]
  panExtent?: [[number, number], [number, number]]
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
  onSavePositions,
  onSaveViewport,
  defaultViewport,
  onNodeClick,
  onEdgeClick,
  onConnectPersist,
  onDropAtFlowPosition,
  showMiniMap = true,
  minimapPortalTarget,
  canvasExtent,
  panExtent,
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
      void reactFlowApi.setCenter(n.position.x + w / 2, n.position.y + h / 2, { duration, zoom: 1.4 })
    },
  }), [reactFlowApi])

  const gridColor = useThemeColor('--color-grid-dot')
  const personColor = useThemeColor('--color-node-person-border')
  const placeColor = useThemeColor('--color-node-place-border')
  const memoryColor = useThemeColor('--color-node-memory-border')
  const fallbackColor = useThemeColor('--color-text-muted')

  const miniMapNodeColor = useCallback((node: Node) => {
    if (node.type === 'anchor' || node.type === 'ringGuide') return 'transparent'
    if (node.type === 'person') return personColor
    if (node.type === 'place') return placeColor
    if (node.type === 'memory') return memoryColor
    return fallbackColor
  }, [personColor, placeColor, memoryColor, fallbackColor])

  const flowWidth = useStore((s) => s.width)
  const flowHeight = useStore((s) => s.height)

  // Cap minZoom so a fully-zoomed-out view fits the canvas extent with a little slack
  const dynamicMinZoom = useMemo(() => {
    const floor = 0.1
    if (!canvasExtent) return floor
    const [[minX, minY], [maxX, maxY]] = canvasExtent
    const extentW = maxX - minX
    const extentH = maxY - minY
    if (flowWidth <= 0 || flowHeight <= 0) return floor
    if (extentW <= 0 || extentH <= 0) return floor
    // 1.08 → ~4% slack on each side beyond the rings at the most-zoomed-out position
    const fitZoom = Math.min(flowWidth / extentW, flowHeight / extentH) / 1.08
    return Math.max(floor, Math.min(fitZoom, 1))
  }, [canvasExtent, flowWidth, flowHeight])

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
      void reactFlowApi.setCenter(point.x, point.y, { duration, zoom })
    },
    [reactFlowApi, flowWidth, flowHeight],
  )

  const [portalHostSize, setPortalHostSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    if (!minimapPortalTarget) return
    const measure = () => {
      const rect = minimapPortalTarget.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setPortalHostSize({ width: rect.width, height: rect.height })
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(minimapPortalTarget)
    return () => observer.disconnect()
  }, [minimapPortalTarget])

  const minimapStyle = minimapPortalTarget
    ? { width: portalHostSize?.width ?? 180, height: portalHostSize?.height ?? 180 }
    : { width: 180, height: 180 }

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
      translateExtent={panExtent ?? canvasExtent}
      nodeExtent={canvasExtent}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      defaultViewport={defaultViewport}
      minZoom={dynamicMinZoom}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      onMoveEnd={(_, viewport) => {
        viewportRef.current = viewport
      }}
      fitView={defaultViewport == null}
      fitViewOptions={{ padding: 0.1, minZoom: dynamicMinZoom, maxZoom: 1 }}
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
        minimapPortalTarget ? (
          createPortal(
            <MiniMap
              pannable
              zoomable
              onClick={onMinimapClick}
              nodeColor={miniMapNodeColor}
              nodeStrokeColor={miniMapNodeColor}
              nodeStrokeWidth={2}
              style={minimapStyle}
            />,
            minimapPortalTarget,
          )
        ) : (
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
        )
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
