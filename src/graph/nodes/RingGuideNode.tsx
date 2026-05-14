import type { NodeProps } from '@xyflow/react'

export function RingGuideNode({ data, width, height }: NodeProps) {
  const w = typeof width === 'number' && Number.isFinite(width) ? width : 0
  const h = typeof height === 'number' && Number.isFinite(height) ? height : 0
  const tier = typeof (data as { tier?: number } | undefined)?.tier === 'number'
    ? ((data as { tier: number }).tier)
    : 0
  if (w <= 0 || h <= 0) return null
  const r = Math.min(w, h) / 2
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
      aria-hidden="true"
    >
      <circle
        cx={w / 2}
        cy={h / 2}
        r={r - 1}
        fill="none"
        stroke={tierStrokeFor(tier)}
        strokeWidth={1.25}
        strokeDasharray="6 6"
        opacity={0.55}
      />
    </svg>
  )
}

function tierStrokeFor(tier: number): string {
  switch (tier) {
    case 1: return 'var(--color-accent)'
    case 2: return 'var(--color-node-person-border)'
    case 3: return 'var(--color-node-memory-border)'
    case 4: return 'var(--color-border-strong)'
    case 5: return 'var(--color-node-place-border)'
    default: return 'var(--color-border)'
  }
}
