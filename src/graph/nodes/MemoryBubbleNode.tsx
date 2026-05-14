import type { NodeProps } from '@xyflow/react'
import { usePhotoUrl } from '../../shared/hooks/usePhotoUrl'

export function MemoryBubbleNode({ data }: NodeProps) {
  const photoPath = typeof (data as { photoPath?: string }).photoPath === 'string'
    ? (data as { photoPath: string }).photoPath
    : ''
  const title = typeof (data as { title?: string }).title === 'string'
    ? (data as { title: string }).title
    : ''
  const date = typeof (data as { date?: string }).date === 'string'
    ? (data as { date: string }).date
    : ''
  const selected = (data as { selected?: boolean }).selected === true
  const resolved = usePhotoUrl(photoPath, undefined) ?? ''

  const baseShadow = '0 4px 10px rgba(var(--color-shadow-rgb), 0.18)'
  const ringShadow = '0 0 0 3px var(--color-node-memory-border)'

  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        backgroundImage: resolved ? `url(${resolved})` : undefined,
        backgroundColor: resolved ? undefined : 'var(--color-node-memory-soft)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: '2px solid var(--color-node-memory-border)',
        boxShadow: selected ? `${ringShadow}, ${baseShadow}` : baseShadow,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-node-memory-text)',
        fontSize: 18,
      }}
      title={title ? `${title}${date ? ` — ${date}` : ''}` : 'Memory'}
      aria-label={title || 'Memory'}
    >
      {resolved ? null : '♥'}
    </div>
  )
}
