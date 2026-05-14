import type { Edge, Node } from '@xyflow/react'
import {
  PERSON_NODE_DEFAULT_SIZE,
  PLACE_NODE_DEFAULT_SIZE,
  SELF_NODE_DEFAULT_SIZE,
} from './dimensions'
import {
  buildRingAssignments,
  type RingTier,
} from './rings'

export const RING_RADII_BASE: Readonly<Record<RingTier, number>> = {
  1: 360,
  2: 680,
  3: 1000,
  4: 1320,
  5: 1620,
} as const

const RING_NODE_WIDTH: Readonly<Record<RingTier, number>> = {
  1: PERSON_NODE_DEFAULT_SIZE.width,
  2: PERSON_NODE_DEFAULT_SIZE.width,
  3: PERSON_NODE_DEFAULT_SIZE.width,
  4: PERSON_NODE_DEFAULT_SIZE.width,
  5: PLACE_NODE_DEFAULT_SIZE.width,
} as const

/** Minimum angular gap between adjacent nodes on the same ring (flow units). */
const MIN_NODE_GAP = 40

/** Visible whitespace (flow units) between the edges of nodes on adjacent rings. */
const RING_BREATHING_ROOM = 110

const SELF_HALF_WIDTH = SELF_NODE_DEFAULT_SIZE.width / 2

/** Center-to-center minimum distance from the previous ring to this ring. */
function minGapBetween(prevHalfWidth: number, outerTier: RingTier): number {
  const outerHalfWidth = RING_NODE_WIDTH[outerTier] / 2
  return prevHalfWidth + outerHalfWidth + RING_BREATHING_ROOM
}

export function computeRingRadii(
  ringAssignments: ReadonlyMap<string, RingTier>,
): Record<RingTier, number> {
  const counts: Record<RingTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const tier of ringAssignments.values()) {
    counts[tier]++
  }

  const radii: Record<RingTier, number> = { ...RING_RADII_BASE }
  let prev = 0
  let prevHalfWidth = SELF_HALF_WIDTH
  for (const tier of [1, 2, 3, 4, 5] as RingTier[]) {
    const n = counts[tier]
    const nodeWidth = RING_NODE_WIDTH[tier]
    const requiredCircumference = n * (nodeWidth + MIN_NODE_GAP)
    const requiredRadius = requiredCircumference / (2 * Math.PI)
    const fromCount = Math.max(RING_RADII_BASE[tier], requiredRadius)
    const fromPrev = prev + minGapBetween(prevHalfWidth, tier)
    const r = Math.max(fromCount, fromPrev)
    radii[tier] = r
    prev = r
    prevHalfWidth = nodeWidth / 2
  }
  return radii
}

export const RING_GUIDE_NODE_TYPE = 'ringGuide'
export const RING_GUIDE_NODE_ID_PREFIX = '__ringGuide_'

export function ringGuideNodeId(tier: RingTier): string {
  return `${RING_GUIDE_NODE_ID_PREFIX}${tier}`
}

export function isRingGuideNodeId(id: string): boolean {
  return id.startsWith(RING_GUIDE_NODE_ID_PREFIX)
}

function phaseForTier(tier: RingTier): number {
  return ((tier - 1) * Math.PI) / 4
}

function computeAngles(
  ringAssignments: ReadonlyMap<string, RingTier>,
): Map<string, number> {
  const byTier = new Map<RingTier, string[]>()
  for (const [id, tier] of ringAssignments) {
    let bucket = byTier.get(tier)
    if (!bucket) {
      bucket = []
      byTier.set(tier, bucket)
    }
    bucket.push(id)
  }

  const out = new Map<string, number>()
  for (const [tier, ids] of byTier) {
    ids.sort()
    const offset = phaseForTier(tier)
    const step = (2 * Math.PI) / ids.length
    ids.forEach((id, i) => {
      out.set(id, offset + i * step)
    })
  }
  return out
}

function dimsForRingedNode(node: Node): { width: number; height: number } {
  const measured = (node as { measured?: { width?: number; height?: number } }).measured
  const w = measured?.width
  const h = measured?.height
  if (typeof w === 'number' && Number.isFinite(w) && typeof h === 'number' && Number.isFinite(h)) {
    return { width: w, height: h }
  }
  if (node.type === 'place') return { ...PLACE_NODE_DEFAULT_SIZE }
  if (node.type === 'self') return { ...SELF_NODE_DEFAULT_SIZE }
  return { ...PERSON_NODE_DEFAULT_SIZE }
}

function isRinged(node: Node): boolean {
  if (node.type !== 'person' && node.type !== 'place') return false
  if (node.parentId) return false
  return true
}

export type PositionMap = Map<string, { x: number; y: number }>

export type RingLayoutResult = {
  positions: PositionMap
  radii: Record<RingTier, number>
}

export function computeRingLayout(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): RingLayoutResult {
  const assignments = buildRingAssignments(nodes, edges)
  const radii = computeRingRadii(assignments)
  const angles = computeAngles(assignments)
  const positions: PositionMap = new Map()

  for (const node of nodes) {
    if (node.type === 'self') {
      const { width, height } = dimsForRingedNode(node)
      positions.set(node.id, { x: -width / 2, y: -height / 2 })
      continue
    }
    if (!isRinged(node)) continue

    const tier = assignments.get(node.id)
    if (tier == null) continue
    const angle = angles.get(node.id)
    if (angle == null) continue
    const radius = radii[tier]

    const cx = radius * Math.cos(angle)
    const cy = radius * Math.sin(angle)
    const { width, height } = dimsForRingedNode(node)
    positions.set(node.id, { x: cx - width / 2, y: cy - height / 2 })
  }

  return { positions, radii }
}

export const ANCHOR_PADDING = 220

export const PAN_PADDING = 700

export function computeAnchorHalfExtent(radii: Record<RingTier, number>): number {
  return radii[5] + ANCHOR_PADDING
}

export function computeCanvasExtent(
  radii: Record<RingTier, number>,
): [[number, number], [number, number]] {
  const h = computeAnchorHalfExtent(radii)
  return [[-h, -h], [h, h]]
}

export function computePanExtent(
  radii: Record<RingTier, number>,
): [[number, number], [number, number]] {
  const h = radii[5] + PAN_PADDING
  return [[-h, -h], [h, h]]
}

export function buildAnchorNodes(halfExtent: number): Node[] {
  const minX = -halfExtent
  const maxX = halfExtent
  const minY = -halfExtent
  const maxY = halfExtent
  const baseProps = {
    type: 'anchor',
    width: 1,
    height: 1,
    data: {},
    draggable: false,
    selectable: false,
    connectable: false,
    deletable: false,
    focusable: false,
    style: { pointerEvents: 'none' as const },
  } as const
  return [
    { id: '__anchor_tl', position: { x: minX, y: minY }, ...baseProps },
    { id: '__anchor_tr', position: { x: maxX, y: minY }, ...baseProps },
    { id: '__anchor_bl', position: { x: minX, y: maxY }, ...baseProps },
    { id: '__anchor_br', position: { x: maxX, y: maxY }, ...baseProps },
  ]
}

export function buildRingGuideNodes(
  visibleRings: ReadonlySet<RingTier>,
  radii: Record<RingTier, number>,
): Node[] {
  const out: Node[] = []
  for (const tier of [1, 2, 3, 4, 5] as RingTier[]) {
    if (!visibleRings.has(tier)) continue
    const r = radii[tier]
    out.push({
      id: ringGuideNodeId(tier),
      type: RING_GUIDE_NODE_TYPE,
      position: { x: -r, y: -r },
      width: r * 2,
      height: r * 2,
      zIndex: -10,
      data: { tier, radius: r },
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      focusable: false,
      style: { pointerEvents: 'none' },
    })
  }
  return out
}
