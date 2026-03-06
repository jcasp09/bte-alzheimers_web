import { useCallback } from 'react'
import { Background, Controls, ReactFlow, addEdge, useEdgesState, useNodesState } from '@xyflow/react'
import type { Connection, Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
// Node types
import { NODE_TYPE, nodeTypes } from '../nodeTypes'
// Image asset (Vite resolves this to a URL)
import browtImage from '../assets/images/browt.jpeg'

// Initial nodes
const initialNodes: Node[] = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: '', image: browtImage },
    type: NODE_TYPE.IMAGE,
    className: 'start-node',
  },
  {
    id: '2',
    position: { x: 0, y: 250 },
    data: { label: 'End node' },
    type: NODE_TYPE.IMAGE,
  },
]

// Initial edges
const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'default' }
]

function FlowDiagram({ nodes: initialNodesProp, edges: initialEdgesProp }: { nodes: Node[]; edges: Edge[] }) {
  const [nodes, , onNodesChange] = useNodesState(initialNodesProp)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdgesProp)

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
      <Background />
      <Controls />
    </ReactFlow>
  )
}

function Graph() {
  return (
    <section>
      <div
        style={{
          height: '80vh',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          border: '1px solid #e2e2e2',
        }}
      >
        <FlowDiagram key={JSON.stringify({ nodes: initialNodes, edges: initialEdges })} nodes={initialNodes} edges={initialEdges} />
      </div>
    </section>
  )
}

export default Graph
