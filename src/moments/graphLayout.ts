import type { Node } from '@xyflow/react'
import type { MomentDoc } from '../firebase/moments'
import { momentRichnessScore, parseOccurredOn } from '../firebase/moments'
import {
  MOMENTS_BUCKET_NODE_SIZE,
  momentsImpactfulCountFloorDiameter,
  momentsImpactfulDayFloorDiameterFromNorm,
} from '../graph/dimensions'

export type ViewMode = 'chronological' | 'impactful'

export type DrillLevel = 'years' | 'months' | 'days'

export type BucketData = {
  /** Primary label (matches person node name line) */
  title: string
  /** Secondary line (muted), e.g. moment counts or date context */
  caption?: string
  kind: 'year' | 'month' | 'day'
  year: number
  month?: number
  day?: number
  /** Single moment for this day (one moment per day) */
  momentId?: string
  /** Impactful year/month only: moment count in this bucket (drives minimum circle size). */
  impactBucketCount?: number
  /** Impactful day only: richness / max richness in this month (0–1), drives minimum circle size. */
  impactDaySizeNorm?: number
}

/** Grid sized for circular moment buckets (diameter grows with text; cells give headroom). */
const COLS = 3
const CELL_W = 240
const CELL_H = 240

/** Golden-angle increment (radians) for even radial spacing. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const CX = 480
const CY = 360

/**
 * Impactful layout: Fermat spiral in screen space. This does not know each node's
 * final measured diameter (circles grow with wrapped text), so day-level spirals
 * use a larger radius step to avoid overlap when only a few days are shown.
 */
type ImpactfulSpiral = { innerGap: number; scale: number }

/** Year/month labels still use variable-diameter circles; keep spiral radii >= pre-size layout. */
const SPIRAL_YEAR: ImpactfulSpiral = { innerGap: 44, scale: 110 }
const SPIRAL_MONTH: ImpactfulSpiral = { innerGap: 44, scale: 112 }
const SPIRAL_DAY: ImpactfulSpiral = { innerGap: 52, scale: 175 }

function gridPlace(i: number): { x: number; y: number } {
  const row = Math.floor(i / COLS)
  const col = i % COLS
  return { x: col * CELL_W, y: row * CELL_H }
}

function impactfulPositions(scores: number[], spiral: ImpactfulSpiral): { x: number; y: number }[] {
  const n = scores.length
  const indexed = scores
    .map((score, i) => ({ score, i }))
    .sort((a, b) => b.score - a.score)

  const posByOriginalIndex: { x: number; y: number }[] = Array.from({ length: n }, () => ({ x: 0, y: 0 }))
  const { innerGap, scale } = spiral
  indexed.forEach((item, rank) => {
    const r = rank === 0 ? 0 : innerGap + Math.sqrt(rank) * scale
    const angle = rank * GOLDEN_ANGLE
    posByOriginalIndex[item.i] = {
      x: CX + r * Math.cos(angle),
      y: CY + r * Math.sin(angle),
    }
  })
  return posByOriginalIndex
}

function buildYearBuckets(moments: MomentDoc[]): { year: number; count: number }[] {
  const byYear = new Map<number, number>()
  moments.forEach((m) => {
    const p = parseOccurredOn(m.occurredOn)
    if (!p) return
    byYear.set(p.y, (byYear.get(p.y) ?? 0) + 1)
  })
  return [...byYear.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year)
}

function buildMonthBuckets(moments: MomentDoc[], selectedYear: number): { month: number; count: number }[] {
  const byMonth = new Map<number, number>()
  moments.forEach((m) => {
    const p = parseOccurredOn(m.occurredOn)
    if (!p || p.y !== selectedYear) return
    byMonth.set(p.m, (byMonth.get(p.m) ?? 0) + 1)
  })
  return [...byMonth.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month - b.month)
}

function buildDayBuckets(
  moments: MomentDoc[],
  selectedYear: number,
  selectedMonth: number,
): { day: number; moment: MomentDoc }[] {
  const byDay = new Map<number, MomentDoc>()
  moments.forEach((m) => {
    const p = parseOccurredOn(m.occurredOn)
    if (!p || p.y !== selectedYear || p.m !== selectedMonth) return
    const prev = byDay.get(p.d)
    const t = m.createdAt?.toMillis() ?? 0
    const pt = prev?.createdAt?.toMillis() ?? 0
    if (!prev || t >= pt) {
      byDay.set(p.d, m)
    }
  })
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, moment]) => ({ day, moment }))
}

export function buildMomentFlowNodes(
  mode: ViewMode,
  level: DrillLevel,
  moments: MomentDoc[],
  selectedYear: number | null,
  selectedMonth: number | null,
  monthNames: string[],
): Node[] {
  if (mode === 'chronological') {
    return buildChronological(level, moments, selectedYear, selectedMonth, monthNames)
  }
  return buildImpactful(level, moments, selectedYear, selectedMonth, monthNames)
}

function buildChronological(
  level: DrillLevel,
  moments: MomentDoc[],
  selectedYear: number | null,
  selectedMonth: number | null,
  monthNames: string[],
): Node[] {
  if (level === 'years') {
    const years = new Set<number>()
    moments.forEach((m) => {
      const p = parseOccurredOn(m.occurredOn)
      if (p) years.add(p.y)
    })
    /** Oldest first: top-left is earliest year, then left-to-right and down. */
    const sorted = [...years].sort((a, b) => a - b)
    return sorted.map((year, i) => {
      const p = gridPlace(i)
      const data: BucketData = { title: String(year), kind: 'year', year }
      return {
        id: `y-${year}`,
        type: 'momentsBucket',
        position: p,
        width: MOMENTS_BUCKET_NODE_SIZE.minDiameter,
        height: MOMENTS_BUCKET_NODE_SIZE.minDiameter,
        data,
        draggable: false,
      }
    })
  }

  if (level === 'months' && selectedYear != null) {
    const months = new Set<number>()
    moments.forEach((m) => {
      const p = parseOccurredOn(m.occurredOn)
      if (p && p.y === selectedYear) months.add(p.m)
    })
    const sorted = [...months].sort((a, b) => a - b)
    return sorted.map((month, i) => {
      const p = gridPlace(i)
      const data: BucketData = {
        title: monthNames[month - 1] ?? String(month),
        kind: 'month',
        year: selectedYear,
        month,
      }
      return {
        id: `m-${selectedYear}-${month}`,
        type: 'momentsBucket',
        position: p,
        width: MOMENTS_BUCKET_NODE_SIZE.minDiameter,
        height: MOMENTS_BUCKET_NODE_SIZE.minDiameter,
        data,
        draggable: false,
      }
    })
  }

  if (level === 'days' && selectedYear != null && selectedMonth != null) {
    const buckets = buildDayBuckets(moments, selectedYear, selectedMonth)
    const monthLabel = monthNames[selectedMonth - 1] ?? String(selectedMonth)
    return buckets.map(({ day, moment }, i) => {
      const p = gridPlace(i)
      const titleTrimmed = moment.title.trim()
      const data: BucketData = {
        title: titleTrimmed.length > 0 ? titleTrimmed : String(day),
        caption: titleTrimmed.length > 0 ? `${monthLabel} ${day}, ${selectedYear}` : monthLabel,
        kind: 'day',
        year: selectedYear,
        month: selectedMonth,
        day,
        momentId: moment.id,
      }
      return {
        id: `d-${selectedYear}-${selectedMonth}-${day}`,
        type: 'momentsBucket',
        position: p,
        width: MOMENTS_BUCKET_NODE_SIZE.minDiameter,
        height: MOMENTS_BUCKET_NODE_SIZE.minDiameter,
        data,
        draggable: false,
      }
    })
  }

  return []
}

function buildImpactful(
  level: DrillLevel,
  moments: MomentDoc[],
  selectedYear: number | null,
  selectedMonth: number | null,
  monthNames: string[],
): Node[] {
  if (level === 'years') {
    const buckets = buildYearBuckets(moments)
    const scores = buckets.map((b) => b.count)
    const positions = impactfulPositions(scores, SPIRAL_YEAR)

    return buckets.map((b, i) => {
      const seed = momentsImpactfulCountFloorDiameter(b.count, 'year')
      const data: BucketData = {
        title: String(b.year),
        caption: `${b.count} moment${b.count === 1 ? '' : 's'}`,
        kind: 'year',
        year: b.year,
        impactBucketCount: b.count,
      }
      return {
        id: `y-${b.year}`,
        type: 'momentsBucket',
        position: positions[i],
        width: seed,
        height: seed,
        data,
        draggable: false,
      }
    })
  }

  if (level === 'months' && selectedYear != null) {
    const buckets = buildMonthBuckets(moments, selectedYear)
    const scores = buckets.map((b) => b.count)
    const positions = impactfulPositions(scores, SPIRAL_MONTH)

    return buckets.map((b, i) => {
      const seed = momentsImpactfulCountFloorDiameter(b.count, 'month')
      const data: BucketData = {
        title: monthNames[b.month - 1] ?? String(b.month),
        caption: `${b.count} moment${b.count === 1 ? '' : 's'}`,
        kind: 'month',
        year: selectedYear,
        month: b.month,
        impactBucketCount: b.count,
      }
      return {
        id: `m-${selectedYear}-${b.month}`,
        type: 'momentsBucket',
        position: positions[i],
        width: seed,
        height: seed,
        data,
        draggable: false,
      }
    })
  }

  if (level === 'days' && selectedYear != null && selectedMonth != null) {
    const buckets = buildDayBuckets(moments, selectedYear, selectedMonth)
    const scores = buckets.map((b) => momentRichnessScore(b.moment))
    const positions = impactfulPositions(scores, SPIRAL_DAY)
    const maxScore = Math.max(...scores, 1e-9)

    return buckets.map((b, i) => {
      const title =
        b.moment.title.trim().length > 0 ? b.moment.title.trim() : `Day ${b.day}`
      const impactNorm = scores[i] / maxScore
      const seed = momentsImpactfulDayFloorDiameterFromNorm(impactNorm)
      const data: BucketData = {
        title,
        caption: `${monthNames[selectedMonth - 1] ?? selectedMonth} ${b.day}, ${selectedYear}`,
        kind: 'day',
        year: selectedYear,
        month: selectedMonth,
        day: b.day,
        momentId: b.moment.id,
        impactDaySizeNorm: impactNorm,
      }
      return {
        id: `d-${selectedYear}-${selectedMonth}-${b.day}`,
        type: 'momentsBucket',
        position: positions[i],
        width: seed,
        height: seed,
        data,
        draggable: false,
      }
    })
  }

  return []
}
