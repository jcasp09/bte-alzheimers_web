import type { NodeProps } from '@xyflow/react'
import { NodeEdgeHandles } from '../components/NodeEdgeHandles'
import { PLACE_NODE_DEFAULT_SIZE } from '../firebase/graph'
import { safeNodeDimensions } from '../nodeSize'

function placeScale(width: number, height: number) {
  return Math.min(
    width / PLACE_NODE_DEFAULT_SIZE.width,
    height / PLACE_NODE_DEFAULT_SIZE.height,
  )
}

export function PlaceNode({ data }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : ''
  const address = typeof data.address === 'string' ? data.address : ''
  const { width: w, height: h } = safeNodeDimensions('place', data.width, data.height)
  const sc = placeScale(w, h)
  const nameFont = Math.min(20, Math.max(10, Math.round(12 * sc)))
  const addrFont = Math.min(16, Math.max(8, Math.round(10 * sc)))
  const pad = Math.max(4, Math.round(8 * sc))
  const borderRadius = Math.max(6, Math.round(8 * sc))

  const showAddress = address.length > 0 && w >= 95 && h >= 55
  const showAddressMultiline = showAddress && w >= 130 && h >= 78

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        minHeight: h,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          minHeight: h,
          boxSizing: 'border-box',
          borderRadius,
          background: '#f3f4f6',
          border: '2px solid #9ca3af',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: nameFont,
          textAlign: 'center',
          padding: pad,
        }}
      >
        <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{name || 'Place'}</span>
        {showAddress ? (
          <span
            style={{
              fontSize: addrFont,
              color: '#6b7280',
              marginTop: Math.max(2, Math.round(4 * sc)),
              lineHeight: 1.35,
              maxWidth: '100%',
              wordBreak: 'break-word',
              display: showAddressMultiline ? 'block' : '-webkit-box',
              WebkitLineClamp: showAddressMultiline ? undefined : 2,
              WebkitBoxOrient: showAddressMultiline ? undefined : 'vertical',
              overflow: showAddressMultiline ? 'visible' : 'hidden',
            }}
          >
            {address}
          </span>
        ) : null}
      </div>
      <NodeEdgeHandles />
    </div>
  )
}
