import { useMemo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { Layer } from '../../../graph/model/flowConstants'
import type { MemoryDoc } from '../../../memories/data/memories'
import { buildRingAssignments, type RingTier } from '../../../graph/model/rings'
import {
  buildAnchorNodes,
  buildRingGuideNodes,
  computeAnchorHalfExtent,
  computeCanvasExtent,
  computePanExtent,
  computeRingLayout,
} from '../../../graph/model/ringLayout'
import {
  buildContextToMemoriesMap,
  buildMemoryLayerEdges,
  buildMemoryLayerNodes,
  filterMemoriesByRange,
  getConnectedIdsForSelection,
  type MemoryBrushRange,
  type MemorySelection,
} from '../../../memories/model/memoryLayer'

type Inputs = {
  nodes: Node[]
  edges: Edge[]
  memories: MemoryDoc[]
  currentLayer: Layer
  visibleRings: ReadonlySet<RingTier>
  showAllEdges: boolean
  memorySelection: MemorySelection | null
  memoryBrushRange: MemoryBrushRange | null
  relationshipSelectedNodeId: string | null
  canvasLinkMode: {
    eligibleTypes: ReadonlySet<string>
    selectedIds: ReadonlySet<string>
  } | null
}

const DIM_OPACITY = 0.35
const LINK_RING_COLOR = '#2bb673'

/** Derive all the memos React Flow needs from canonical state. */
export function useDisplayElements(input: Inputs) {
  const {
    nodes, edges, memories,
    currentLayer, visibleRings, showAllEdges,
    memorySelection, memoryBrushRange,
    relationshipSelectedNodeId,
    canvasLinkMode,
  } = input

  const ringAssignments = useMemo(
    () => buildRingAssignments(nodes, edges),
    [nodes, edges],
  )

  const { positions: ringPositions, radii: ringRadii } = useMemo(
    () => computeRingLayout(nodes, edges),
    [nodes, edges],
  )

  const anchorNodes = useMemo(
    () => buildAnchorNodes(computeAnchorHalfExtent(ringRadii)),
    [ringRadii],
  )

  const canvasExtent = useMemo(
    () => computeCanvasExtent(ringRadii),
    [ringRadii],
  )

  const panExtent = useMemo(
    () => computePanExtent(ringRadii),
    [ringRadii],
  )

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
      return [...anchorNodes, ...styled]
    }
    const filtered = nodes.map((n) => {
      const t = n.type
      if (t !== 'self' && t !== 'group') {
        const tier = ringAssignments.get(n.id)
        if (tier != null && !visibleRings.has(tier)) {
          return { ...n, hidden: true }
        }
      }

      const ringPos = ringPositions.get(n.id)
      const ringed = ringPos != null
      const baseStyle = n.style ?? {}
      const baseNode = ringed
        ? { ...n, position: ringPos, draggable: false }
        : n

      if (canvasLinkMode) {
        const isLinked = canvasLinkMode.selectedIds.has(n.id)
        const isEligible = typeof n.type === 'string' && canvasLinkMode.eligibleTypes.has(n.type)
        if (isLinked) {
          return {
            ...baseNode,
            style: {
              ...baseStyle,
              opacity: 1,
              boxShadow: `0 0 0 3px ${LINK_RING_COLOR}`,
              borderRadius: 12,
            },
          }
        }
        if (isEligible) {
          return {
            ...baseNode,
            style: {
              ...baseStyle,
              opacity: 1,
              cursor: 'pointer',
              boxShadow: `0 0 0 2px rgba(43, 182, 115, 0.28)`,
              borderRadius: 12,
            },
          }
        }
        return { ...baseNode, style: { ...baseStyle, opacity: DIM_OPACITY } }
      }

      if (!relationshipConnectedIds) return baseNode
      const isSelected = n.id === relationshipSelectedNodeId
      const inScope = relationshipConnectedIds.has(n.id)
      if (isSelected) {
        return {
          ...baseNode,
          style: {
            ...baseStyle,
            opacity: 1,
            boxShadow: '0 0 0 3px var(--color-accent)',
            borderRadius: 12,
          },
        }
      }
      if (inScope) {
        return { ...baseNode, style: { ...baseStyle, opacity: 1 } }
      }
      return { ...baseNode, style: { ...baseStyle, opacity: DIM_OPACITY } }
    })

    const guides = buildRingGuideNodes(visibleRings, ringRadii)
    return [...anchorNodes, ...guides, ...filtered]
  }, [nodes, visibleMemories, visibleRings, ringAssignments, ringPositions, ringRadii, anchorNodes, currentLayer, memoryConnectedIds, memorySelection, relationshipConnectedIds, relationshipSelectedNodeId, canvasLinkMode])

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
      if (!(visible.has(e.source) && visible.has(e.target))) {
        return { ...e, hidden: true }
      }

      if (canvasLinkMode) {
        return { ...e, style: { ...(e.style ?? {}), opacity: DIM_OPACITY } }
      }

      const touchesSelection =
        relationshipSelectedNodeId != null &&
        (e.source === relationshipSelectedNodeId || e.target === relationshipSelectedNodeId)

      if (touchesSelection) {
        return { ...e, style: { ...(e.style ?? {}), opacity: 1 } }
      }
      if (showAllEdges) {
        return {
          ...e,
          style: {
            ...(e.style ?? {}),
            opacity: 0.6,
            strokeDasharray: '5 4',
            strokeWidth: 1.5,
          },
        }
      }
      return { ...e, hidden: true }
    })
  }, [edges, displayNodes, visibleMemories, currentLayer, memorySelection, relationshipSelectedNodeId, canvasLinkMode, showAllEdges])

  return {
    visibleMemories,
    contextToMemories,
    memoryConnectedIds,
    displayNodes,
    displayEdges,
    canvasExtent,
    panExtent,
  }
}
