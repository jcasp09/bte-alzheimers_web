import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export function PersonNode({ data }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : ''
  const relationship = typeof data.relationship === 'string' ? data.relationship : ''
  const email = typeof data.email === 'string' ? data.email : ''
  const image = typeof data.image === 'string' ? data.image : ''
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          width: 80,
          minHeight: 80,
          borderRadius: '50%',
          background: image
            ? `url(${image})`
            : 'url(https://via.placeholder.com/150)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
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
        <span style={{ fontWeight: 600 }}>{name || 'Person'}</span>
        {relationship ? (
          <span style={{ fontSize: 10, color: '#6b7280' }}>{relationship}</span>
        ) : null}
        {email ? (
          <span style={{ fontSize: 9, color: '#6b7280', wordBreak: 'break-all' }}>
            {email}
          </span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  )
}
