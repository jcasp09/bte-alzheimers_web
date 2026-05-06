import { useCallback, useEffect, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import type { Edge, Node, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { MomentsBucketNode } from '../nodeTypes/MomentsBucketNode'
import { getThemeColor, subscribeToThemeChange } from '../services/theme'

const momentsNodeTypes = {
  momentsBucket: MomentsBucketNode,
}

type MomentsFlowInnerProps = {
  nodes: Node[]
  onNodeClick: NodeMouseHandler
}

function MomentsFlowInner({ nodes: initialNodes, onNodeClick }: MomentsFlowInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState<Edge>([])
  const { fitView } = useReactFlow()

  const [gridColor, setGridColor] = useState<string>(() => getThemeColor('--color-grid-dot') ?? '#d1d5db')
  useEffect(() => {
    return subscribeToThemeChange(() => {
      const resolved = getThemeColor('--color-grid-dot')
      if (resolved) setGridColor(resolved)
    })
  }, [])

  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return initialNodes.map((n) => {
        const p = prevById.get(n.id)
        if (
          p &&
          typeof p.width === 'number' &&
          typeof p.height === 'number' &&
          Number.isFinite(p.width) &&
          Number.isFinite(p.height)
        ) {
          return { ...n, width: p.width, height: p.height }
        }
        return { ...n }
      })
    })
  }, [initialNodes, setNodes])

  useEffect(() => {
    queueMicrotask(() => {
      fitView({ padding: 0.2, duration: 200 })
    })
  }, [initialNodes, fitView])

  const noopConnect = useCallback(() => {}, [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={noopConnect}
      nodeTypes={momentsNodeTypes}
      onNodeClick={onNodeClick}
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnScroll
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
    >
      <Background id="moments-bg" gap={25} color={gridColor} variant={BackgroundVariant.Cross} />
      <Controls />
    </ReactFlow>
  )
}

type MomentsFlowProps = {
  nodes: Node[]
  onNodeClick: NodeMouseHandler
}

export function MomentsFlow({ nodes, onNodeClick }: MomentsFlowProps) {
  return (
    <ReactFlowProvider>
      <MomentsFlowInner nodes={nodes} onNodeClick={onNodeClick} />
    </ReactFlowProvider>
  )
}
