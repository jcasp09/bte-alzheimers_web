import { useLayoutEffect, useRef } from 'react'
import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import {
  MOMENTS_BUCKET_NODE_SIZE,
  momentsImpactfulCountFloorDiameter,
  momentsImpactfulDayFloorDiameterFromNorm,
} from '../graph/dimensions'
import type { BucketData } from '../moments/graphLayout'

const TITLE_FS = 14
const CAPTION_FS = 12

export type MomentsBucketNodeData = BucketData

const { minDiameter, maxTextWidth, innerPadding } = MOMENTS_BUCKET_NODE_SIZE

/** Extra pixels so the circle fully contains the measured text block (border + slack). */
const DIAMETER_MARGIN = 8

export function MomentsBucketNode({ data, id, width, height }: NodeProps) {
  const d = data as BucketData
  const measureRef = useRef<HTMLDivElement>(null)
  const rf = useReactFlow()

  const title = typeof d.title === 'string' ? d.title : ''
  const caption = typeof d.caption === 'string' && d.caption.length > 0 ? d.caption : ''
  const impactCount =
    (d.kind === 'year' || d.kind === 'month') && typeof d.impactBucketCount === 'number'
      ? d.impactBucketCount
      : null
  const countFloor =
    impactCount != null
      ? momentsImpactfulCountFloorDiameter(impactCount, d.kind === 'month' ? 'month' : 'year')
      : minDiameter

  const dayImpactFloor =
    d.kind === 'day' && typeof d.impactDaySizeNorm === 'number'
      ? momentsImpactfulDayFloorDiameterFromNorm(d.impactDaySizeNorm)
      : minDiameter

  const semanticFloor =
    d.kind === 'day' ? Math.max(minDiameter, dayImpactFloor) : Math.max(minDiameter, countFloor)

  const curD = Math.max(
    semanticFloor,
    minDiameter,
    typeof width === 'number' && Number.isFinite(width) ? width : minDiameter,
    typeof height === 'number' && Number.isFinite(height) ? height : minDiameter,
  )

  const usableChord = Math.floor(curD - 2 * innerPadding - DIAMETER_MARGIN)
  const textMax = Math.min(maxTextWidth, Math.max(40, usableChord))

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const rw = r.width
    const rh = r.height
    if (rw < 1 || rh < 1) return
    const textD = Math.max(minDiameter, Math.ceil(Math.hypot(rw, rh) + 2 * innerPadding + DIAMETER_MARGIN))
    const next = Math.max(textD, semanticFloor)
    const node = rf.getNode(id)
    const prevW = node?.width ?? minDiameter
    const prevH = node?.height ?? minDiameter
    if (prevW === next && prevH === next) return
    rf.updateNode(id, { width: next, height: next })
  }, [caption, id, rf, semanticFloor, textMax, title])

  return (
    <div
      style={{
        width: curD,
        height: curD,
        boxSizing: 'border-box',
        borderRadius: '50%',
        background: 'var(--color-surface)',
        border: '2px solid var(--color-border-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        ref={measureRef}
        style={{
          boxSizing: 'border-box',
          maxWidth: textMax,
          padding: innerPadding,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: TITLE_FS,
            color: 'var(--color-text)',
            lineHeight: 1.35,
            width: '100%',
            whiteSpace: 'normal',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {title || 'Moment'}
        </span>
        {caption ? (
          <span
            style={{
              fontSize: CAPTION_FS,
              color: 'var(--color-text-muted)',
              lineHeight: 1.35,
              width: '100%',
              whiteSpace: 'normal',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
          >
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  )
}
