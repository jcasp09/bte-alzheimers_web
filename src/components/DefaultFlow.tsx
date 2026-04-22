import { useCallback, useEffect, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import type {
  Connection,
  Edge,
  EdgeMouseHandler,
  Node,
  NodeMouseHandler,
  OnEdgesChange,
  Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from '../nodeTypes'

type DefaultFlowProps = {
  nodes: Node[]
  edges: Edge[]
  /** When provided with `edges`, the parent owns edge state (smooth deferred saves). */
  onEdgesChange?: OnEdgesChange
  onSavePositions?: (nodes: Node[]) => void
  onSaveViewport?: (viewport: Viewport) => void
  defaultViewport?: Viewport
  onNodeClick?: NodeMouseHandler
  onEdgeClick?: EdgeMouseHandler
  /** Parent queues the connection locally; do not call addEdge here. */
  onConnectPersist?: (connection: Connection) => void
}

export function DefaultFlow({
  nodes: initialNodes,
  edges: initialEdges,
  onEdgesChange: onEdgesChangeFromParent,
  onSavePositions,
  onSaveViewport,
  defaultViewport,
  onNodeClick,
  onEdgeClick,
  onConnectPersist,
}: DefaultFlowProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [internalEdges, setInternalEdges, onInternalEdgesChange] = useEdgesState(initialEdges)
  const viewportRef = useRef<Viewport | null>(null)

  const controlledEdges = onEdgesChangeFromParent != null
  const edges = controlledEdges ? initialEdges : internalEdges
  const onEdgesChange = controlledEdges ? onEdgesChangeFromParent : onInternalEdgesChange

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

  // When this flow unmounts, give the latest node positions back to the parent.
  // Parents can choose to persist positions (e.g., to Firestore) without saving on every drag.
  useEffect(() => {
    return () => {
      if (onSavePositions) {
        onSavePositions(nodes)
      }
      if (onSaveViewport && viewportRef.current) {
        onSaveViewport(viewportRef.current)
      }
    }
  }, [nodes, onSavePositions, onSaveViewport])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      defaultViewport={defaultViewport}
      onMoveEnd={(_, viewport) => {
        viewportRef.current = viewport
      }}
      fitView={defaultViewport == null}
    >
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
