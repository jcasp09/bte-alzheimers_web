import type { NodeProps } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { NodeEdgeHandles } from '../components/NodeEdgeHandles'
import { PERSON_NODE_DEFAULT_SIZE } from '../firebase/graph'
import { safeNodeDimensions } from '../nodeSize'
import { storage } from '../firebase/storage'

function personScale(width: number, height: number) {
  return Math.min(
    width / PERSON_NODE_DEFAULT_SIZE.width,
    height / PERSON_NODE_DEFAULT_SIZE.height,
  )
}

/** Up to two letters from a person's name; falls back to '?' for blank names. */
function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed)
    return '?'

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1)
    return parts[0].charAt(0).toUpperCase()

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function PersonNode({ data }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : ''
  const relationship = typeof data.relationship === 'string' ? data.relationship : ''
  const email = typeof data.email === 'string' ? data.email : ''
  const phone = typeof data.phone === 'string' ? data.phone : ''
  const photoPath = typeof data.photoPath === 'string' ? data.photoPath : ''
  const [fetchedPhoto, setFetchedPhoto] = useState<{ path: string; url: string } | null>(null)

  const { width: w, height: h } = safeNodeDimensions('person', data.width, data.height)
  const sc = personScale(w, h)
  const fontSize = Math.min(20, Math.max(10, Math.round(12 * sc)))
  const relFont = Math.min(16, Math.max(9, Math.round(10 * sc)))
  const contactFont = Math.min(14, Math.max(8, Math.round(9 * sc)))
  const avatar = Math.min(100, Math.max(32, Math.round(80 * sc)))
  const pad = Math.max(4, Math.round(5 * sc))
  const gap = Math.max(4, Math.round(10 * sc))
  const borderRadius = Math.max(6, Math.round(12 * sc))

  const showRelationship = w >= 165 && h >= 46
  const showEmailPhone = w >= 205 && h >= 72

  useEffect(() => {
    if (!photoPath)
      return

    let isCancelled = false
    void getDownloadURL(ref(storage, photoPath))
      .then((url) => {
        if (!isCancelled) {
          setFetchedPhoto({ path: photoPath, url })
        }
      })
      .catch(() => {
        // Ignore lookup failures and use initials fallback.
      })

    return () => {
      isCancelled = true
    }
  }, [photoPath])

  const resolvedImageUrl = fetchedPhoto?.path === photoPath ? fetchedPhoto.url : ''

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
          background: '#f9fafb',
          border: '2px solid #9ca3af',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          fontSize,
          textAlign: 'left',
          padding: pad,
          gap,
        }}
      >
        <div
          style={{
            width: avatar,
            height: avatar,
            borderRadius: '9999px',
            backgroundImage: resolvedImageUrl ? `url(${resolvedImageUrl})` : undefined,
            backgroundColor: resolvedImageUrl ? undefined : '#e5e7eb',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid #9ca3af',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4b5563',
            fontSize: Math.round(avatar * 0.4),
            fontWeight: 600,
            userSelect: 'none',
          }}
          aria-label={name ? `${name} avatar` : 'Person avatar'}
        >
          {resolvedImageUrl ? null : getInitials(name)}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: Math.max(1, Math.round(2 * sc)),
            overflow: 'hidden',
            minWidth: 0,
            flex: 1,
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
            {name || 'Person'}
          </span>
          {showRelationship && relationship ? (
            <span
              style={{
                fontSize: relFont,
                color: '#6b7280',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {relationship}
            </span>
          ) : null}
          {showEmailPhone && email ? (
            <span
              style={{
                fontSize: contactFont,
                color: '#6b7280',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {email}
            </span>
          ) : null}
          {showEmailPhone && phone ? (
            <span
              style={{
                fontSize: contactFont,
                color: '#6b7280',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {phone}
            </span>
          ) : null}
        </div>
      </div>
      <NodeEdgeHandles />
    </div>
  )
}
