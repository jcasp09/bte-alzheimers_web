import type { NodeProps } from '@xyflow/react'
import { GROUP_NODE_DEFAULT_SIZE } from '../dimensions'

export function GroupNode({ data, width, height }: NodeProps) {
  const w = typeof width === 'number' && Number.isFinite(width) ? width : GROUP_NODE_DEFAULT_SIZE.width
  const h = typeof height === 'number' && Number.isFinite(height) ? height : GROUP_NODE_DEFAULT_SIZE.height
  const label = typeof data.name === 'string' && data.name.trim() ? data.name : 'Group'

  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderRadius: 12,
        border: '2px dashed var(--color-border-strong)',
        background: 'var(--color-group-fill)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '10px 12px',
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </div>
  )
}
