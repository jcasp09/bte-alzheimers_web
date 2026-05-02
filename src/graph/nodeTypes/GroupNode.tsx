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
        border: '2px dashed #94a3b8',
        background: 'rgba(243, 244, 246, 0.65)',
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
          color: '#475569',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </div>
  )
}
