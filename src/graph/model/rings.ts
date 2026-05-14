import type { Edge, Node } from '@xyflow/react'
import { SELF_NODE_ID } from './types'

export type RingTier = 1 | 2 | 3 | 4 | 5

export type RingDescriptor = {
  tier: RingTier
  label: string
  hint: string
  scope: 'people' | 'places'
}

export const RINGS: ReadonlyArray<RingDescriptor> = [
  {
    tier: 1,
    label: 'Favorites',
    hint: 'The people closest to you — spouse, parents, children, siblings, or anyone you choose to keep nearest.',
    scope: 'people',
  },
  {
    tier: 2,
    label: 'Family',
    hint: 'Extended family — grandparents, aunts, uncles, cousins, in-laws.',
    scope: 'people',
  },
  {
    tier: 3,
    label: 'Friends',
    hint: 'Personal friends.',
    scope: 'people',
  },
  {
    tier: 4,
    label: 'Community',
    hint: 'Neighbors, coworkers, doctors, caregivers, and other people in your life.',
    scope: 'people',
  },
  {
    tier: 5,
    label: 'Places',
    hint: 'Meaningful places — home, workplaces, regular destinations.',
    scope: 'places',
  },
] as const

export const ALL_RING_TIERS: ReadonlyArray<RingTier> = RINGS.map((r) => r.tier) as RingTier[]

export const OUTERMOST_PEOPLE_RING: RingTier = 4
export const OUTERMOST_PLACE_RING: RingTier = 5

export function defaultVisibleRings(): Set<RingTier> {
  return new Set<RingTier>(ALL_RING_TIERS)
}

export function getRing(tier: number | null | undefined): RingDescriptor | null {
  if (tier == null) return null
  return RINGS.find((r) => r.tier === tier) ?? null
}

export function coerceRingTier(value: unknown): RingTier | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value
  return null
}

const RELATIONSHIP_KEYWORDS: ReadonlyArray<readonly [string, RingTier]> = [
  // Specific / multi-word first so they beat their substrings.
  ['mother-in-law', 2],
  ['father-in-law', 2],
  ['sister-in-law', 2],
  ['brother-in-law', 2],
  ['son-in-law', 2],
  ['daughter-in-law', 2],
  ['in-law', 2],
  ['in law', 2],

  // Extended family to Family
  ['grand', 2],
  ['step', 2],
  ['god', 2],
  ['uncle', 2],
  ['aunt', 2],
  ['cousin', 2],
  ['niece', 2],
  ['nephew', 2],

  // Immediate family to Favorites
  ['mother', 1],
  ['father', 1],
  ['mom', 1],
  ['dad', 1],
  ['parent', 1],
  ['spouse', 1],
  ['husband', 1],
  ['wife', 1],
  ['partner', 1],
  ['daughter', 1],
  ['son', 1],
  ['child', 1],
  ['kid', 1],
  ['brother', 1],
  ['sister', 1],
  ['sibling', 1],

  // Friends to Friends
  ['friend', 3],
  ['acquaintance', 3],

  // Community: neighbors / coworkers / providers to Community
  ['neighbor', 4],
  ['neighbour', 4],
  ['coworker', 4],
  ['colleague', 4],
  ['boss', 4],
  ['employee', 4],
  ['manager', 4],
  ['doctor', 4],
  ['nurse', 4],
  ['therapist', 4],
  ['caregiver', 4],
  ['caretaker', 4],
  ['teacher', 4],
  ['mentor', 4],
  ['pastor', 4],
  ['priest', 4],
  ['rabbi', 4],
  ['imam', 4],
  ['work', 4],
]

export function inferRingFromRelationship(relationship: string | undefined | null): RingTier | null {
  if (typeof relationship !== 'string') return null
  const text = relationship.toLowerCase().trim()
  if (text.length === 0) return null

  let bestMatch: { keyword: string; tier: RingTier } | null = null
  for (const [keyword, tier] of RELATIONSHIP_KEYWORDS) {
    if (!text.includes(keyword)) continue
    if (bestMatch == null || keyword.length > bestMatch.keyword.length) {
      bestMatch = { keyword, tier }
    }
  }
  return bestMatch?.tier ?? null
}

export function graphDistanceFromSelf(
  nodeId: string,
  edges: ReadonlyArray<Edge>,
): number {
  if (nodeId === SELF_NODE_ID) return 0

  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const s = e.source
    const t = e.target
    if (!adj.has(s)) adj.set(s, [])
    if (!adj.has(t)) adj.set(t, [])
    adj.get(s)!.push(t)
    adj.get(t)!.push(s)
  }

  const visited = new Set<string>([SELF_NODE_ID])
  let frontier: string[] = [SELF_NODE_ID]
  let depth = 0
  while (frontier.length > 0) {
    depth++
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbor of adj.get(id) ?? []) {
        if (visited.has(neighbor)) continue
        if (neighbor === nodeId) return depth
        visited.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }
  return Infinity
}

function distanceToPeopleRing(distance: number): RingTier {
  if (distance <= 1) return 1
  if (distance === 2) return 2
  if (distance === 3) return 3
  return OUTERMOST_PEOPLE_RING
}

export type InferenceNodeInput = {
  id: string
  type: string
  ringTier?: number | null
  relationship?: string | null
}

export function inferRingTier(
  node: InferenceNodeInput,
  edges: ReadonlyArray<Edge>,
): RingTier | null {
  if (node.type === 'place') return OUTERMOST_PLACE_RING

  if (node.type !== 'person') return null

  const override = coerceRingTier(node.ringTier)
  if (override != null && override !== OUTERMOST_PLACE_RING) return override

  const fromKeyword = inferRingFromRelationship(node.relationship)
  if (fromKeyword != null) return fromKeyword

  const d = graphDistanceFromSelf(node.id, edges)
  if (Number.isFinite(d)) return distanceToPeopleRing(d)

  return OUTERMOST_PEOPLE_RING
}

export function buildRingAssignments(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): Map<string, RingTier> {
  const out = new Map<string, RingTier>()
  for (const n of nodes) {
    const input: InferenceNodeInput = {
      id: n.id,
      type: typeof n.type === 'string' ? n.type : '',
      ringTier: typeof n.data?.ringTier === 'number' ? n.data.ringTier : null,
      relationship: typeof n.data?.relationship === 'string' ? n.data.relationship : null,
    }
    const tier = inferRingTier(input, edges)
    if (tier != null) out.set(n.id, tier)
  }
  return out
}
