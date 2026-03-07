import { useCallback } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import type { Connection, Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from '../nodeTypes'

type DefaultFlowProps = {
  nodes: Node[]
  edges: Edge[]
}

export function DefaultFlow({ nodes: initialNodes, edges: initialEdges }: DefaultFlowProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
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
