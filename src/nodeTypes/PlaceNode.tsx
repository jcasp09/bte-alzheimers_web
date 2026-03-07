import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export function PlaceNode({ data }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : ''
  const address = typeof data.address === 'string' ? data.address : ''
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          width: 80,
          minHeight: 80,
          borderRadius: 8,
          background: '#f3f4f6',
          border: '2px solid #9ca3af',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          textAlign: 'center',
          padding: 8,
        }}
      >
        <span style={{ fontWeight: 600 }}>{name || 'Place'}</span>
        {address ? (
          <span style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
            {address}
          </span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  )
}
