import { useCallback, useEffect, useState, type DragEvent as ReactDragEvent } from 'react'
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
import { DOCK_NODE_DND_TYPE } from './DefaultFlow'
import { getThemeColor, subscribeToThemeChange } from '../services/theme'

const momentsNodeTypes = {
  momentsBucket: MomentsBucketNode,
}

type MomentsFlowInnerProps = {
  nodes: Node[]
  onNodeClick: NodeMouseHandler
  onMomentDrop?: () => void
}

function MomentsFlowInner({ nodes: initialNodes, onNodeClick, onMomentDrop }: MomentsFlowInnerProps) {
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
  }, [fitView])

  const handleDragOver = useCallback((e: ReactDragEvent) => {
    if (!onMomentDrop) return
    if (!Array.from(e.dataTransfer.types).includes(DOCK_NODE_DND_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [onMomentDrop])

  const handleDrop = useCallback((e: ReactDragEvent) => {
    if (!onMomentDrop) return
    const kind = e.dataTransfer.getData(DOCK_NODE_DND_TYPE)
    if (kind !== 'moment') return
    e.preventDefault()
    onMomentDrop()
  }, [onMomentDrop])

  const noopConnect = useCallback(() => {}, [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={noopConnect}
      onDragOver={onMomentDrop ? handleDragOver : undefined}
      onDrop={onMomentDrop ? handleDrop : undefined}
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
  onMomentDrop?: () => void
}

export function MomentsFlow({ nodes, onNodeClick, onMomentDrop }: MomentsFlowProps) {
  return (
    <ReactFlowProvider>
      <MomentsFlowInner nodes={nodes} onNodeClick={onNodeClick} onMomentDrop={onMomentDrop} />
    </ReactFlowProvider>
  )
}
