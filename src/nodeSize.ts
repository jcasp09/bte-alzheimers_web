import { PERSON_NODE_DEFAULT_SIZE, PLACE_NODE_DEFAULT_SIZE } from './firebase/graph'

const DIMENSION_RATIO = { min: 0.5, max: 2.5 } as const

function boundsForType(nodeType: 'person' | 'place') {
  const base = nodeType === 'person' ? PERSON_NODE_DEFAULT_SIZE : PLACE_NODE_DEFAULT_SIZE
  return {
    minW: Math.round(base.width * DIMENSION_RATIO.min),
    maxW: Math.round(base.width * DIMENSION_RATIO.max),
    minH: Math.round(base.height * DIMENSION_RATIO.min),
    maxH: Math.round(base.height * DIMENSION_RATIO.max),
  }
}

export function defaultNodeSize(nodeType: 'person' | 'place') {
  return nodeType === 'person' ? { ...PERSON_NODE_DEFAULT_SIZE } : { ...PLACE_NODE_DEFAULT_SIZE }
}

export function clampNodeDimensions(
  nodeType: 'person' | 'place',
  width: number,
  height: number,
): { width: number; height: number } {
  const { minW, maxW, minH, maxH } = boundsForType(nodeType)
  return {
    width: Math.min(maxW, Math.max(minW, Math.round(width))),
    height: Math.min(maxH, Math.max(minH, Math.round(height))),
  }
}

export function canDecreaseNodeSize(
  nodeType: 'person' | 'place',
  width: number,
  height: number,
): boolean {
  const cur = clampNodeDimensions(nodeType, width, height)
  const next = stepNodeDimensions(nodeType, cur.width, cur.height, -1)
  return next.width !== cur.width || next.height !== cur.height
}

export function canIncreaseNodeSize(
  nodeType: 'person' | 'place',
  width: number,
  height: number,
): boolean {
  const cur = clampNodeDimensions(nodeType, width, height)
  const next = stepNodeDimensions(nodeType, cur.width, cur.height, 1)
  return next.width !== cur.width || next.height !== cur.height
}

/** 10% larger or smaller, then clamp. */
export function stepNodeDimensions(
  nodeType: 'person' | 'place',
  width: number,
  height: number,
  direction: 1 | -1,
): { width: number; height: number } {
  const factor = direction === 1 ? 1.1 : 0.9
  return clampNodeDimensions(nodeType, Math.round(width * factor), Math.round(height * factor))
}

/** Sanitize numbers from Firestore for display. */
export function safeNodeDimensions(
  nodeType: 'person' | 'place',
  width: unknown,
  height: unknown,
): { width: number; height: number } {
  const d = defaultNodeSize(nodeType)
  const w = typeof width === 'number' && Number.isFinite(width) ? width : d.width
  const h = typeof height === 'number' && Number.isFinite(height) ? height : d.height
  return clampNodeDimensions(nodeType, w, h)
}
