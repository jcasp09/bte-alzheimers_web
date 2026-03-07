import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

// Default Image Node
export function PersonNode({ data }: NodeProps) {
  const label = typeof data.label === 'string' ? data.label : ''
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `url(${data.image || 'https://via.placeholder.com/150'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '2px solid #9ca3af',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          textAlign: 'center',
          padding: 8,
        }}
      >
        {label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  )
}
