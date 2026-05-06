// Default UI/render size for nodes
export const PERSON_NODE_DEFAULT_SIZE = { width: 220, height: 100 } as const
/** Moments buckets render as circles; diameter is derived from wrapped text in MomentsBucketNode. */
export const MOMENTS_BUCKET_NODE_SIZE = {
  minDiameter: 80,
  maxTextWidth: 132,
  innerPadding: 6,
} as const

export type MomentsImpactfulBucketKind = 'year' | 'month'

/**
 * Impactful year/month: minimum diameter grows with moment count.
 * Months use a much steeper step than years so 1 vs 3 moments reads clearly.
 */
export function momentsImpactfulCountFloorDiameter(
  momentCount: number,
  bucket: MomentsImpactfulBucketKind = 'year',
): number {
  const { minDiameter } = MOMENTS_BUCKET_NODE_SIZE
  const c = Math.max(1, Math.floor(momentCount))
  const perStep = bucket === 'month' ? 40 : 18
  const cap = bucket === 'month' ? 300 : 180
  const extra = Math.min(cap, (c - 1) * perStep)
  return minDiameter + extra
}

/**
 * Impactful day: size from richness relative to other days in the same month (0–1).
 * Blend linear + sqrt so the top day is larger but not overwhelming (happy medium vs text-only sizing).
 */
export function momentsImpactfulDayFloorDiameterFromNorm(impactNorm: number): number {
  const { minDiameter } = MOMENTS_BUCKET_NODE_SIZE
  const t = Math.min(1, Math.max(0, impactNorm))
  const blended = 0.55 * t + 0.45 * Math.sqrt(t)
  const extra = Math.round(blended * 140)
  return minDiameter + extra
}
export const PLACE_NODE_DEFAULT_SIZE = { width: 120, height: 100 } as const
export const GROUP_NODE_DEFAULT_SIZE = { width: 400, height: 300 } as const

const GROUP_MAX_DIMENSION = 2000

// Node size multipliers
const NODE_SIZE_RATIO_BOUNDS = { min: 0.5, max: 2.5 } as const
const NODE_SIZE_STEP_FACTOR = 1.1

export const GROUP_DIMENSION_BOUNDS = { min: 200, max: GROUP_MAX_DIMENSION } as const
export const GROUP_DRAW_BOUNDS = { minW: 80, minH: 60, max: GROUP_MAX_DIMENSION } as const

type ResizableNodeType = 'person' | 'place'

function boundsForType(nodeType: ResizableNodeType) {
  const base = nodeType === 'person' ? PERSON_NODE_DEFAULT_SIZE : PLACE_NODE_DEFAULT_SIZE
  return {
    minW: Math.round(base.width * NODE_SIZE_RATIO_BOUNDS.min),
    maxW: Math.round(base.width * NODE_SIZE_RATIO_BOUNDS.max),
    minH: Math.round(base.height * NODE_SIZE_RATIO_BOUNDS.min),
    maxH: Math.round(base.height * NODE_SIZE_RATIO_BOUNDS.max),
  }
}

export function defaultNodeSize(nodeType: ResizableNodeType) {
  return nodeType === 'person' ? { ...PERSON_NODE_DEFAULT_SIZE } : { ...PLACE_NODE_DEFAULT_SIZE }
}

export function clampNodeDimensions(
  nodeType: ResizableNodeType,
  width: number,
  height: number,
): { width: number; height: number } {
  const { minW, maxW, minH, maxH } = boundsForType(nodeType)
  return {
    width: Math.min(maxW, Math.max(minW, Math.round(width))),
    height: Math.min(maxH, Math.max(minH, Math.round(height))),
  }
}

/** One step (10% by default) larger or smaller, then clamp. */
export function stepNodeDimensions(
  nodeType: ResizableNodeType,
  width: number,
  height: number,
  direction: 1 | -1,
): { width: number; height: number } {
  const factor = direction === 1 ? NODE_SIZE_STEP_FACTOR : 1 / NODE_SIZE_STEP_FACTOR
  return clampNodeDimensions(nodeType, Math.round(width * factor), Math.round(height * factor))
}

export function canDecreaseNodeSize(
  nodeType: ResizableNodeType,
  width: number,
  height: number,
): boolean {
  const cur = clampNodeDimensions(nodeType, width, height)
  const next = stepNodeDimensions(nodeType, cur.width, cur.height, -1)
  return next.width !== cur.width || next.height !== cur.height
}

export function canIncreaseNodeSize(
  nodeType: ResizableNodeType,
  width: number,
  height: number,
): boolean {
  const cur = clampNodeDimensions(nodeType, width, height)
  const next = stepNodeDimensions(nodeType, cur.width, cur.height, 1)
  return next.width !== cur.width || next.height !== cur.height
}

/** Sanitize possibly-bad numbers from Firestore into a safe {width, height} for display. */
export function safeNodeDimensions(
  nodeType: ResizableNodeType,
  width: unknown,
  height: unknown,
): { width: number; height: number } {
  const d = defaultNodeSize(nodeType)
  const w = typeof width === 'number' && Number.isFinite(width) ? width : d.width
  const h = typeof height === 'number' && Number.isFinite(height) ? height : d.height
  return clampNodeDimensions(nodeType, w, h)
}

/** Clamp an arbitrary value (possibly NaN/non-number) to GROUP_DIMENSION_BOUNDS, with a fallback. */
export function clampGroupDimension(value: unknown, fallback: number): number {
  const v = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(GROUP_DIMENSION_BOUNDS.max, Math.max(GROUP_DIMENSION_BOUNDS.min, v))
}
