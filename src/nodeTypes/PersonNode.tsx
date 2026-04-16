import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../firebase/storage'

export function PersonNode({ data }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : ''
  const relationship = typeof data.relationship === 'string' ? data.relationship : ''
  const email = typeof data.email === 'string' ? data.email : ''
  const phone = typeof data.phone === 'string' ? data.phone : ''
  const directImage = typeof data.image === 'string' ? data.image : ''
  const photoUrl = typeof data.photoUrl === 'string' ? data.photoUrl : ''
  const photoPath = typeof data.photoPath === 'string' ? data.photoPath : ''
  const [fetchedPhoto, setFetchedPhoto] = useState<{ path: string; url: string } | null>(null)

  useEffect(() => {
    let isCancelled = false

    if (directImage || photoUrl || !photoPath) {
      return () => {
        isCancelled = true
      }
    }

    void getDownloadURL(ref(storage, photoPath))
      .then((url) => {
        if (!isCancelled) {
          setFetchedPhoto({ path: photoPath, url })
        }
      })
      .catch(() => {
        // Ignore lookup failures and keep placeholder fallback.
      })

    return () => {
      isCancelled = true
    }
  }, [directImage, photoPath, photoUrl])

  const resolvedImageUrl =
    directImage
    || photoUrl
    || (fetchedPhoto?.path === photoPath ? fetchedPhoto.url : '')

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          width: 220,
          minHeight: 80,
          borderRadius: 12,
          background: '#f9fafb',
          border: '2px solid #9ca3af',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          fontSize: 12,
          textAlign: 'left',
          padding: 5,
          gap: 10,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '9999px',
            backgroundImage: resolvedImageUrl
              ? `url(${resolvedImageUrl})`
              : 'url(https://via.placeholder.com/96)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid #9ca3af',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {name || 'Person'}
          </span>
          {relationship ? (
            <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {relationship}
            </span>
          ) : null}
          {email ? (
            <span style={{ fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {email}
            </span>
          ) : null}
          {phone ? (
            <span style={{ fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {phone}
            </span>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  )
}
