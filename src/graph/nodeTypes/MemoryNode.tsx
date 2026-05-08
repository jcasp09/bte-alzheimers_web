import type { NodeProps } from '@xyflow/react'
import { NodeEdgeHandles } from '../../components/NodeEdgeHandles'
import { usePhotoUrl } from '../../shared/hooks/usePhotoUrl'

export const MEMORY_NODE_DEFAULT_SIZE = { width: 200, height: 100 } as const

function formatOccurredOn(occurredOn: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(occurredOn.trim())
  if (!m) return occurredOn
  const y = +m[1]
  const month = +m[2]
  const d = +m[3]
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthName = months[month - 1] ?? String(month)
  return `${monthName} ${d}, ${y}`
}

export function MemoryNode({ data }: NodeProps) {
  const title = typeof data.title === 'string' ? data.title : ''
  const occurredOn = typeof data.occurredOn === 'string' ? data.occurredOn : ''
  const photoPath = typeof data.photoPath === 'string' ? data.photoPath : ''
  const resolvedImageUrl = usePhotoUrl(photoPath) ?? ''

  const dateLabel = occurredOn ? formatOccurredOn(occurredOn) : ''
  const showTitleFallback = title.trim().length === 0

  return (
    <div
      style={{
        position: 'relative',
        width: MEMORY_NODE_DEFAULT_SIZE.width,
        minHeight: MEMORY_NODE_DEFAULT_SIZE.height,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          minHeight: MEMORY_NODE_DEFAULT_SIZE.height,
          boxSizing: 'border-box',
          borderRadius: 12,
          background: resolvedImageUrl ? `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%), url(${resolvedImageUrl})` : 'var(--color-node-memory)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '2px solid var(--color-node-memory-border)',
          color: resolvedImageUrl ? '#fff' : 'var(--color-node-memory-text)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '8px 10px',
          fontSize: 13,
          gap: 2,
          textShadow: resolvedImageUrl ? '0 1px 3px rgba(0,0,0,0.6)' : undefined,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            fontSize: 14,
            opacity: showTitleFallback ? 0.7 : 1,
          }}
        >
          {showTitleFallback ? (dateLabel || 'Memory') : title}
        </span>
        {!showTitleFallback && dateLabel ? (
          <span
            style={{
              fontSize: 11,
              opacity: resolvedImageUrl ? 0.95 : 0.7,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {dateLabel}
          </span>
        ) : null}
      </div>
      <NodeEdgeHandles />
    </div>
  )
}
