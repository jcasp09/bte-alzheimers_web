import { useMemo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { Layer } from '../../../graph/model/flowConstants'
import type { MemoryDoc } from '../../../memories/data/memories'
import {
  buildContextToMemoriesMap,
  buildMemoryLayerEdges,
  buildMemoryLayerNodes,
  filterMemoriesByRange,
  getConnectedIdsForSelection,
  type MemoryBrushRange,
  type MemorySelection,
} from '../../../memories/model/memoryLayer'
import { ANCHOR_NODES, type VisibleTypes } from '../lib/nodeMappers'

type Inputs = {
  nodes: Node[]
  edges: Edge[]
  memories: MemoryDoc[]
  currentLayer: Layer
  visibleTypes: VisibleTypes
  memorySelection: MemorySelection | null
  memoryBrushRange: MemoryBrushRange | null
  relationshipSelectedNodeId: string | null
}

const DIM_OPACITY = 0.35

/** Derive all the memos React Flow needs from canonical state. */
export function useDisplayElements(input: Inputs) {
  const {
    nodes, edges, memories,
    currentLayer, visibleTypes,
    memorySelection, memoryBrushRange,
    relationshipSelectedNodeId,
  } = input

  // Apply the timeline brush, if any.
  const visibleMemories = useMemo(
    () => filterMemoriesByRange(memories, memoryBrushRange),
    [memories, memoryBrushRange],
  )

  const contextToMemories = useMemo(
    () => buildContextToMemoriesMap(visibleMemories),
    [visibleMemories],
  )

  // Set of node IDs in scope for the current selection (null when nothing selected).
  const memoryConnectedIds = useMemo<Set<string> | null>(() => {
    if (!memorySelection) return null
    return getConnectedIdsForSelection(memorySelection, visibleMemories, contextToMemories)
  }, [memorySelection, visibleMemories, contextToMemories])

  // Connected node ids for the relationship-layer selection (selected + neighbours via edges).
  const relationshipConnectedIds = useMemo<Set<string> | null>(() => {
    if (!relationshipSelectedNodeId) return null
    const ids = new Set<string>([relationshipSelectedNodeId])
    for (const e of edges) {
      if (e.source === relationshipSelectedNodeId) ids.add(e.target)
      else if (e.target === relationshipSelectedNodeId) ids.add(e.source)
    }
    return ids
  }, [edges, relationshipSelectedNodeId])

  const displayNodes = useMemo(() => {
    if (currentLayer === 'memories') {
      const memoryNodes = buildMemoryLayerNodes(visibleMemories, nodes)
      // When a selection is active, dim everything not in scope and ring the selected node
      const styled = memoryConnectedIds
        ? memoryNodes.map((n) => {
            if (n.type === 'anchor') return n
            const inScope = memoryConnectedIds.has(n.id)
            const isSelected = memorySelection != null && n.id === memorySelection.id
            const baseStyle = n.style ?? {}
            if (!inScope) {
              return { ...n, style: { ...baseStyle, opacity: DIM_OPACITY } }
            }
            if (isSelected) {
              return {
                ...n,
                style: {
                  ...baseStyle,
                  opacity: 1,
                  boxShadow: '0 0 0 3px var(--color-accent)',
                  borderRadius: 12,
                },
              }
            }
            // Connected (in-scope) but not the selection itself
            return { ...n, style: { ...baseStyle, opacity: 1 } }
          })
        : memoryNodes
      return [...ANCHOR_NODES, ...styled]
    }
    const filtered = nodes.map((n) => {
      const t = n.type
      const allowed = (t === 'person' && visibleTypes.person)
        || (t === 'place' && visibleTypes.place)
        || (t === 'group' && visibleTypes.group)
      if (!allowed) return { ...n, hidden: true }
      if (!relationshipConnectedIds) return n
      const baseStyle = n.style ?? {}
      const isSelected = n.id === relationshipSelectedNodeId
      const inScope = relationshipConnectedIds.has(n.id)
      if (isSelected) {
        return {
          ...n,
          style: {
            ...baseStyle,
            opacity: 1,
            boxShadow: '0 0 0 3px var(--color-accent)',
            borderRadius: 12,
          },
        }
      }
      if (inScope) {
        return { ...n, style: { ...baseStyle, opacity: 1 } }
      }
      return { ...n, style: { ...baseStyle, opacity: DIM_OPACITY } }
    })
    return [...ANCHOR_NODES, ...filtered]
  }, [nodes, visibleMemories, visibleTypes, currentLayer, memoryConnectedIds, memorySelection, relationshipConnectedIds, relationshipSelectedNodeId])

  const displayEdges = useMemo(() => {
    if (currentLayer === 'memories') {
      const synth = buildMemoryLayerEdges(visibleMemories)
      if (!memorySelection) {
        return synth.map((e) => ({
          ...e,
          style: { ...(e.style ?? {}), opacity: 0.4 },
        }))
      }
      return synth.map((e) => {
        const touches = e.source === memorySelection.id || e.target === memorySelection.id
        return {
          ...e,
          style: { ...(e.style ?? {}), opacity: touches ? 1 : DIM_OPACITY },
        }
      })
    }
    const visible = new Set(displayNodes.filter((n) => !n.hidden).map((n) => n.id))
    return edges.map((e) => {
      const hidden = !(visible.has(e.source) && visible.has(e.target))
      if (hidden) return { ...e, hidden: true }
      if (!relationshipSelectedNodeId) return e
      const touches = e.source === relationshipSelectedNodeId || e.target === relationshipSelectedNodeId
      return {
        ...e,
        style: { ...(e.style ?? {}), opacity: touches ? 1 : DIM_OPACITY },
      }
    })
  }, [edges, displayNodes, visibleMemories, currentLayer, memorySelection, relationshipSelectedNodeId])

  return {
    visibleMemories,
    contextToMemories,
    memoryConnectedIds,
    displayNodes,
    displayEdges,
  }
}
