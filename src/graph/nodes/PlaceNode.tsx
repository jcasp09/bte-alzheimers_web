import type { NodeProps } from '@xyflow/react'
import { NodeEdgeHandles } from '../components/NodeEdgeHandles'
import { usePhotoUrl } from '../../shared/hooks/usePhotoUrl'
import { PLACE_NODE_DEFAULT_SIZE, safeNodeDimensions } from '../model/dimensions'
import { getInitialsForAvatar } from '../../shared/util/initials'

function placeScale(width: number, height: number) {
  return Math.min(
    width / PLACE_NODE_DEFAULT_SIZE.width,
    height / PLACE_NODE_DEFAULT_SIZE.height,
  )
}

export function PlaceNode({ data }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : ''
  const address = typeof data.address === 'string' ? data.address : ''
  const photoPath = typeof data.photoPath === 'string' ? data.photoPath : ''
  const photoUpdatedAt = typeof data.photoUpdatedAt === 'string' ? data.photoUpdatedAt : undefined
  const memoryCount = typeof data.memoryCount === 'number' && Number.isFinite(data.memoryCount)
    ? data.memoryCount
    : 0
  const selectionRing = (data as { selectionRing?: { color: string; width: number } }).selectionRing
  const resolvedImageUrl = usePhotoUrl(photoPath, photoUpdatedAt) ?? ''
  const { width: w, height: h } = safeNodeDimensions('place', data.width, data.height)
  const sc = placeScale(w, h)
  const nameFont = Math.min(20, Math.max(10, Math.round(12 * sc)))
  const addrFont = Math.min(16, Math.max(8, Math.round(10 * sc)))

  const avatar = Math.round(h * 1.15)
  const avatarPokeOut = Math.round(avatar * 0.5)
  const textPaddingLeft = Math.max(8, avatar - avatarPokeOut + 8)
  const verticalPad = Math.max(4, Math.round(6 * sc))
  const borderRadius = Math.max(8, Math.round(14 * sc))

  const showAddress = address.length > 0 && w >= 150 && h >= 55

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
          background: 'var(--color-node-place)',
          border: '2px solid var(--color-node-place-border)',
          boxShadow: selectionRing
            ? `0 0 0 ${selectionRing.width}px ${selectionRing.color}`
            : undefined,
          color: 'var(--color-node-place-text)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: Math.max(1, Math.round(2 * sc)),
          fontSize: nameFont,
          textAlign: 'left',
          paddingTop: verticalPad,
          paddingBottom: verticalPad,
          paddingLeft: textPaddingLeft,
          paddingRight: 12,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {name || 'Place'}
        </span>
        {showAddress ? (
          <span
            style={{
              fontSize: addrFont,
              color: 'var(--color-text-muted)',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {address}
          </span>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: -avatarPokeOut,
          top: '50%',
          transform: 'translateY(-50%)',
          width: avatar,
          height: avatar,
          borderRadius: '50%',
          backgroundImage: resolvedImageUrl ? `url(${resolvedImageUrl})` : undefined,
          backgroundColor: resolvedImageUrl ? undefined : 'var(--color-node-place-soft)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '2px solid var(--color-node-place-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-node-place-text)',
          fontSize: Math.round(avatar * 0.4),
          fontWeight: 600,
          userSelect: 'none',
          zIndex: 1,
          boxSizing: 'border-box',
        }}
        aria-label={name ? `${name} photo` : 'Place photo'}
      >
        {resolvedImageUrl ? null : getInitialsForAvatar(name) || '?'}
      </div>

      {memoryCount > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            minWidth: 28,
            height: 28,
            padding: '0 8px',
            borderRadius: 14,
            background: 'var(--color-node-memory-border)',
            color: 'var(--color-text-inverse)',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--color-surface-raised)',
            boxShadow: '0 2px 4px rgba(var(--color-shadow-rgb), 0.18)',
            pointerEvents: 'none',
            zIndex: 2,
            boxSizing: 'border-box',
          }}
          aria-label={`${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} linked`}
          title={`${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'}`}
        >
          {memoryCount}
        </div>
      ) : null}

      <NodeEdgeHandles />
    </div>
  )
}
