import { useMemo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { Layer } from '../../../graph/model/flowConstants'
import type { MemoryDoc } from '../../../memories/data/memories'
import type { UpcomingTask } from '../../../graph/data/tasks'
import { buildRingAssignments, type RingTier } from '../../../graph/model/rings'
import {
  buildAnchorNodes,
  buildMemoryBubbleNodes,
  buildRingGuideNodes,
  computeAnchorHalfExtent,
  computeCanvasExtent,
  computePanExtent,
  computeRingLayout,
  memoryBubbleNodeId,
} from '../../../graph/model/ringLayout'
import { getMemoryMillis } from '../../../memories/model/memoryLayer'
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
  tasks: UpcomingTask[]
  currentLayer: Layer
  visibleRings: ReadonlySet<RingTier>
  showAllEdges: boolean
  memoryLensOn: boolean
  memoryLensRange: MemoryBrushRange | null
  memorySelection: MemorySelection | null
  memoryBrushRange: MemoryBrushRange | null
  relationshipSelectedNodeId: string | null
  canvasLinkMode: {
    eligibleTypes: ReadonlySet<string>
    selectedIds: ReadonlySet<string>
  } | null
}

const UPCOMING_BADGE_WINDOW_HOURS = 24

const DIM_OPACITY = 0.35
const LINK_RING_COLOR = '#2bb673'
const MEMORY_RING_COLOR = 'var(--color-node-memory-border)'

/** Derive all the memos React Flow needs from canonical state. */
export function useDisplayElements(input: Inputs) {
  const {
    nodes, edges, memories, tasks,
    currentLayer, visibleRings, showAllEdges,
    memoryLensOn, memoryLensRange,
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

  const memoryCountByNode = useMemo<Map<string, number>>(() => {
    const counts = new Map<string, number>()
    for (const m of memories) {
      for (const id of m.personNodeIds) counts.set(id, (counts.get(id) ?? 0) + 1)
      for (const id of m.placeNodeIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [memories])

  const imminentTaskNodeIds = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    // eslint-disable-next-line react-hooks/purity -- per-render snapshot is fine; tasks deps refresh on reload
    const cutoffMs = Date.now() + UPCOMING_BADGE_WINDOW_HOURS * 60 * 60 * 1000
    for (const task of tasks) {
      if (task.startAtMs > cutoffMs) break
      if (!Array.isArray(task.linkedNodeIds)) continue
      for (const id of task.linkedNodeIds) out.add(id)
    }
    return out
  }, [tasks])

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
            return { ...n, style: { ...baseStyle, opacity: 1 } }
          })
        : memoryNodes
      return [...anchorNodes, ...styled]
    }
    let filtered = nodes.map((n) => {
      const t = n.type
      if (t !== 'self') {
        const tier = ringAssignments.get(n.id)
        if (tier != null && !visibleRings.has(tier)) {
          return { ...n, hidden: true }
        }
      }

      const ringPos = ringPositions.get(n.id)
      const ringed = ringPos != null
      const baseStyle = n.style ?? {}
      const memoryCount = memoryCountByNode.get(n.id) ?? 0
      const hasUpcomingTask = imminentTaskNodeIds.has(n.id)
      let dataWithMemoryCount: Record<string, unknown> = { ...(n.data ?? {}) }
      if (memoryCount > 0) dataWithMemoryCount.memoryCount = memoryCount
      if (hasUpcomingTask) dataWithMemoryCount.hasUpcomingTask = true
      if (memoryCount === 0 && !hasUpcomingTask) {
        dataWithMemoryCount = (n.data ?? {}) as Record<string, unknown>
      }
      const baseNode = ringed
        ? { ...n, position: ringPos, draggable: false, data: dataWithMemoryCount }
        : { ...n, data: dataWithMemoryCount }

      if (canvasLinkMode) {
        const isLinked = canvasLinkMode.selectedIds.has(n.id)
        const isEligible = typeof n.type === 'string' && canvasLinkMode.eligibleTypes.has(n.type)
        if (isLinked) {
          return {
            ...baseNode,
            data: { ...dataWithMemoryCount, selectionRing: { color: LINK_RING_COLOR, width: 3 } },
            style: { ...baseStyle, opacity: 1 },
          }
        }
        if (isEligible) {
          return {
            ...baseNode,
            data: { ...dataWithMemoryCount, selectionRing: { color: 'rgba(43, 182, 115, 0.28)', width: 2 } },
            style: { ...baseStyle, opacity: 1, cursor: 'pointer' },
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
          data: { ...dataWithMemoryCount, selectionRing: { color: 'var(--color-accent)', width: 3 } },
          style: { ...baseStyle, opacity: 1 },
        }
      }
      if (inScope) {
        return { ...baseNode, style: { ...baseStyle, opacity: 1 } }
      }
      return { ...baseNode, style: { ...baseStyle, opacity: DIM_OPACITY } }
    })

    const guides = buildRingGuideNodes(visibleRings, ringRadii)

    let bubbles: Node[] = []
    if (memoryLensOn) {
      const inWindow = memories.filter((m) => {
        if (memoryLensRange == null) return true
        const ms = getMemoryMillis(m)
        return ms != null && ms >= memoryLensRange.start && ms <= memoryLensRange.end
      })
      const anchorInputs = inWindow.map((m) => ({
        id: m.id,
        date: m.occurredOn,
        title: m.title,
        photoPath: m.photoPaths[0],
        linkedIds: [...m.personNodeIds, ...m.placeNodeIds],
      }))
      const anchorBoxes = new Map<string, { position: { x: number; y: number }; width: number; height: number }>()
      for (const n of nodes) {
        const pos = ringPositions.get(n.id)
        if (!pos) continue
        const measured = (n as { measured?: { width?: number; height?: number } }).measured
        const width = (typeof measured?.width === 'number' && Number.isFinite(measured.width))
          ? measured.width
          : (typeof n.width === 'number' && Number.isFinite(n.width) ? n.width : 220)
        const height = (typeof measured?.height === 'number' && Number.isFinite(measured.height))
          ? measured.height
          : (typeof n.height === 'number' && Number.isFinite(n.height) ? n.height : 100)
        anchorBoxes.set(n.id, { position: pos, width, height })
      }
      bubbles = buildMemoryBubbleNodes(anchorInputs, anchorBoxes, ringAssignments)
    }

    const selectedMemoryId = memorySelection?.kind === 'memory' ? memorySelection.id : null
    if (selectedMemoryId && memoryLensOn) {
      const targetBubbleId = memoryBubbleNodeId(selectedMemoryId)
      const bubbleExists = bubbles.some((b) => b.id === targetBubbleId)
      if (bubbleExists) {
        const selectedMemory = memories.find((m) => m.id === selectedMemoryId)
        const linkedIds = new Set<string>([
          ...(selectedMemory?.personNodeIds ?? []),
          ...(selectedMemory?.placeNodeIds ?? []),
        ])
        bubbles = bubbles.map((b) => {
          if (b.id === targetBubbleId) {
            return {
              ...b,
              data: { ...(b.data ?? {}), selected: true },
              style: { ...(b.style ?? {}), opacity: 1 },
            }
          }
          return { ...b, style: { ...(b.style ?? {}), opacity: DIM_OPACITY } }
        })
        filtered = filtered.map((n) => {
          if (n.hidden) return n
          const baseStyle = n.style ?? {}
          if (linkedIds.has(n.id)) {
            return {
              ...n,
              data: { ...(n.data ?? {}), selectionRing: { color: MEMORY_RING_COLOR, width: 3 } },
              style: { ...baseStyle, opacity: 1 },
            }
          }
          if (n.type === 'self') {
            return { ...n, style: { ...baseStyle, opacity: 1 } }
          }
          return { ...n, style: { ...baseStyle, opacity: DIM_OPACITY } }
        })
      }
    }

    return [...anchorNodes, ...guides, ...filtered, ...bubbles]
  }, [nodes, memories, visibleMemories, visibleRings, ringAssignments, ringPositions, ringRadii, anchorNodes, memoryCountByNode, imminentTaskNodeIds, memoryLensOn, memoryLensRange, currentLayer, memoryConnectedIds, memorySelection, relationshipConnectedIds, relationshipSelectedNodeId, canvasLinkMode])

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

    const synthMemoryEdges: Edge[] = []
    const selectedMemoryId = memorySelection?.kind === 'memory' ? memorySelection.id : null
    if (memoryLensOn && selectedMemoryId) {
      const bubbleId = memoryBubbleNodeId(selectedMemoryId)
      if (visible.has(bubbleId)) {
        const m = memories.find((mem) => mem.id === selectedMemoryId)
        if (m) {
          for (const id of [...m.personNodeIds, ...m.placeNodeIds]) {
            if (!visible.has(id)) continue
            synthMemoryEdges.push({
              id: `__memEdge_${selectedMemoryId}__${id}`,
              source: bubbleId,
              target: id,
              style: {
                stroke: 'var(--color-node-memory-border)',
                strokeWidth: 2,
                strokeDasharray: '5 4',
                opacity: 0.9,
              },
              zIndex: 4,
              selectable: false,
              focusable: false,
              deletable: false,
            } as Edge)
          }
        }
      }
    }

    const mapped = edges.map((e) => {
      if (!(visible.has(e.source) && visible.has(e.target))) {
        return { ...e, hidden: true }
      }
      if (canvasLinkMode) {
        return { ...e, style: { ...(e.style ?? {}), opacity: DIM_OPACITY } }
      }
      if (selectedMemoryId) {
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

    return [...synthMemoryEdges, ...mapped]
  }, [edges, displayNodes, visibleMemories, memories, memoryLensOn, currentLayer, memorySelection, relationshipSelectedNodeId, canvasLinkMode, showAllEdges])

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
