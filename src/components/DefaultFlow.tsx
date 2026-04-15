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
import type { Connection, Edge, EdgeMouseHandler, Node, NodeMouseHandler, Viewport } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from '../nodeTypes'

type DefaultFlowProps = {
  nodes: Node[]
  edges: Edge[]
  onSavePositions?: (nodes: Node[]) => void
  onSaveViewport?: (viewport: Viewport) => void
  defaultViewport?: Viewport
  onNodeClick?: NodeMouseHandler
  onEdgeClick?: EdgeMouseHandler
}

export function DefaultFlow({
  nodes: initialNodes,
  edges: initialEdges,
  onSavePositions,
  onSaveViewport,
  defaultViewport,
  onNodeClick,
  onEdgeClick,
}: DefaultFlowProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const viewportRef = useRef<Viewport | null>(null)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges],
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
