import type { Edge, Node } from '@xyflow/react'
import type { MemoryDoc } from '../data/memories'
import { parseOccurredOn } from '../data/memories'
import { CENTER_SOURCE_HANDLE_ID, CENTER_TARGET_HANDLE_ID } from '../../graph/components/NodeEdgeHandles'
import { MEMORY_NODE_DEFAULT_SIZE } from '../../graph/nodes/MemoryNode'

/** Opacity applied to context nodes that are not connected to any memory. */
const FADED_CONTEXT_OPACITY = 0.25

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
/** Inner radius before the spiral starts spreading */
const MEMORY_SPIRAL_INNER = 220
/** Per-step spread; tuned so adjacent memories rarely overlap visually. */
const MEMORY_SPIRAL_STEP = 95

/** Prefix for the IDs of synthesized (non-persisted) memory-layer edges.
 *  Used by {@link buildMemoryLayerEdges} to mint IDs and by edge-click handlers
 *  to short-circuit operations that would 404 against Firestore. */
export const SYNTH_EDGE_PREFIX = 'synth:'

/** UTC midnight ms for a memory's `occurredOn`, or null if it doesn't parse. */
export function getMemoryMillis(m: MemoryDoc): number | null {
  const p = parseOccurredOn(m.occurredOn)
  if (!p) return null
  return Date.UTC(p.y, p.m - 1, p.d)
}

/** A brush range on the memory timeline, in UTC ms (inclusive on both ends). */
export type MemoryBrushRange = { start: number; end: number }

/** Filter memories to those falling within [start, end]. */
export function filterMemoriesByRange(
  memories: readonly MemoryDoc[],
  range: MemoryBrushRange | null,
): MemoryDoc[] {
  if (!range) return [...memories]
  return memories.filter((m) => {
    const ms = getMemoryMillis(m)
    if (ms == null) return false
    return ms >= range.start && ms <= range.end
  })
}

/** Sort key for a memory's `occurredOn` (YYYY-MM-DD). */
function memorySortKey(m: MemoryDoc): number {
  const p = parseOccurredOn(m.occurredOn)
  if (!p) return Number.MAX_SAFE_INTEGER
  return p.y * 10000 + p.m * 100 + p.d
}

export function buildMemorySpiralPositions(memories: MemoryDoc[]): Map<string, { x: number; y: number }> {
  const sorted = [...memories].sort((a, b) => memorySortKey(a) - memorySortKey(b))
  const positions = new Map<string, { x: number; y: number }>()
  sorted.forEach((m, rank) => {
    const r = rank === 0 ? 0 : MEMORY_SPIRAL_INNER + Math.sqrt(rank) * MEMORY_SPIRAL_STEP
    const angle = rank * GOLDEN_ANGLE
    positions.set(m.id, { x: r * Math.cos(angle), y: r * Math.sin(angle) })
  })
  return positions
}

/** IDs of every person/place a memory touches, deduped across all memories. */
export function collectConnectedNodeIds(memories: MemoryDoc[]): Set<string> {
  const ids = new Set<string>()
  for (const m of memories) {
    for (const id of m.personNodeIds) ids.add(id)
    for (const id of m.placeNodeIds) ids.add(id)
  }
  return ids
}

/** Build the React Flow node list for the Memories layer.
 *  - Connected people/places appear at full opacity, at their saved positions.
 *  - Unconnected people/places appear faded (still draggable=false to discourage
 *    accidental moves while in this layer).
 *  - Memories are added at spiral positions. */
export function buildMemoryLayerNodes(
  memories: MemoryDoc[],
  contextNodes: readonly Node[],
): Node[] {
  const positions = buildMemorySpiralPositions(memories)
  const connected = collectConnectedNodeIds(memories)

  const out: Node[] = []
  for (const n of contextNodes) {
    if (n.type !== 'person' && n.type !== 'place') continue
    if (connected.has(n.id)) {
      out.push({ ...n, draggable: false })
    } else {
      out.push({
        ...n,
        draggable: false,
        style: { ...(n.style ?? {}), opacity: FADED_CONTEXT_OPACITY },
      })
    }
  }

  for (const m of memories) {
    const pos = positions.get(m.id) ?? { x: 0, y: 0 }
    out.push({
      id: m.id,
      type: 'memory',
      position: pos,
      width: MEMORY_NODE_DEFAULT_SIZE.width,
      height: MEMORY_NODE_DEFAULT_SIZE.height,
      draggable: false,
      data: {
        title: m.title,
        description: m.description,
        occurredOn: m.occurredOn,
        photoPath: m.photoPaths[0],
        photoPaths: m.photoPaths,
        personNodeIds: m.personNodeIds,
        placeNodeIds: m.placeNodeIds,
      },
    })
  }
  return out
}

/** Synthesize edges from each memory to its referenced people/places. These are derived, not persisted. */
export function buildMemoryLayerEdges(memories: MemoryDoc[]): Edge[] {
  const edges: Edge[] = []
  const baseProps = {
    sourceHandle: CENTER_SOURCE_HANDLE_ID,
    targetHandle: CENTER_TARGET_HANDLE_ID,
    selectable: false,
    focusable: false,
    deletable: false,
  } as const
  for (const m of memories) {
    for (const personId of m.personNodeIds) {
      edges.push({
        id: `${SYNTH_EDGE_PREFIX}${m.id}->${personId}`,
        source: m.id,
        target: personId,
        ...baseProps,
      })
    }
    for (const placeId of m.placeNodeIds) {
      edges.push({
        id: `${SYNTH_EDGE_PREFIX}${m.id}->${placeId}`,
        source: m.id,
        target: placeId,
        ...baseProps,
      })
    }
  }
  return edges
}

/** Reverse index: context node id -> set of memory ids that reference it. */
export function buildContextToMemoriesMap(memories: MemoryDoc[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const m of memories) {
    for (const id of m.personNodeIds) {
      let s = out.get(id)
      if (!s) { s = new Set<string>(); out.set(id, s) }
      s.add(m.id)
    }
    for (const id of m.placeNodeIds) {
      let s = out.get(id)
      if (!s) { s = new Set<string>(); out.set(id, s) }
      s.add(m.id)
    }
  }
  return out
}

/** A bidirectional selection in the Memories layer. */
export type MemorySelection =
  | { kind: 'memory'; id: string }
  | { kind: 'context'; id: string }

/** IDs that are "in scope" for the selection. */
export function getConnectedIdsForSelection(
  selection: MemorySelection,
  memories: readonly MemoryDoc[],
  contextToMemories: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  const out = new Set<string>([selection.id])
  if (selection.kind === 'memory') {
    const m = memories.find((x) => x.id === selection.id)
    if (m) {
      for (const id of m.personNodeIds) out.add(id)
      for (const id of m.placeNodeIds) out.add(id)
    }
  } else {
    const memoryIds = contextToMemories.get(selection.id)
    if (memoryIds) for (const id of memoryIds) out.add(id)
  }
  return out
}
