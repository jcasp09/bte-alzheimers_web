import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' ', '')
}

function formatDateRange(startIso: string, endIso: string) {
  if (!startIso) return ''
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return ''

  const dayPart = start.toLocaleDateString([], {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  })

  const startTimePart = formatTime(start)

  if (!endIso) return `${dayPart} ${startTimePart}`
  const end = new Date(endIso)
  if (Number.isNaN(end.getTime())) return `${dayPart} ${startTimePart}`
  const endTimePart = formatTime(end)

  return `${dayPart} ${startTimePart}-${endTimePart}`
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function TaskNode({ data }: NodeProps) {
  const title = typeof data.title === 'string' ? data.title : ''
  const startAt = typeof data.startAt === 'string' ? data.startAt : ''
  const endAt = typeof data.endAt === 'string' ? data.endAt : ''
  const location = typeof data.location === 'string' ? data.location : ''
  const dateRangeLabel = formatDateRange(startAt, endAt)
  const now = new Date()
  const startDate = startAt ? new Date(startAt) : null
  const endDate = endAt ? new Date(endAt) : null
  const startMs = startDate && !Number.isNaN(startDate.getTime()) ? startDate.getTime() : null
  const endMs = endDate && !Number.isNaN(endDate.getTime()) ? endDate.getTime() : null
  const startDayMs =
    startDate && startMs != null
      ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
      : null
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const isToday = startDate != null && startMs != null && isSameCalendarDay(startDate, now)
  const isLaterThanToday = startDayMs != null && startDayMs > todayMs

  const isOngoing =
    startMs != null &&
    endMs != null &&
    startMs <= now.getTime() &&
    endMs >= now.getTime()
  const minutesUntilStart =
    startMs != null ? Math.abs(startMs - now.getTime()) / (1000 * 60) : Number.POSITIVE_INFINITY
  const isClosestWindow = isToday && (isOngoing || minutesUntilStart <= 90)
  const isCompact = isLaterThanToday
  const nodeWidth = isCompact ? 150 : 190
  const nodeMinHeight = isCompact ? 80 : 120
  const backgroundColor = isClosestWindow ? '#dcfce7' : '#f8fafc'
  const borderColor = isToday ? '#0f172a' : '#94a3b8'

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          width: nodeWidth,
          minHeight: nodeMinHeight,
          borderRadius: 10,
          background: backgroundColor,
          border: `2px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          fontSize: 12,
          textAlign: 'left',
          padding: 10,
          gap: 4,
        }}
      >
        <span style={{ fontWeight: 700 }}>{title || 'Task'}</span>
        {!isCompact && dateRangeLabel ? <span style={{ fontSize: 10, color: '#334155' }}>{dateRangeLabel}</span> : null}
        {!isCompact && location ? <span style={{ fontSize: 10, color: '#64748b' }}>{location}</span> : null}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  )
}
