import type { Edge } from '@xyflow/react'
import type { EdgeDoc } from './types'

/** Legacy layout: connect from bottom of source to top of target. */
export const DEFAULT_SOURCE_HANDLE = 'src-bottom' as const
export const DEFAULT_TARGET_HANDLE = 'tgt-top' as const

export const EDGE_SIDES = ['top', 'right', 'bottom', 'left'] as const
export type EdgeSide = (typeof EDGE_SIDES)[number]

export function sourceHandleForSide(side: EdgeSide): string {
  return `src-${side}`
}

export function targetHandleForSide(side: EdgeSide): string {
  return `tgt-${side}`
}

const HANDLE_TO_LABEL: Record<string, string> = {
  'src-top': 'Top (out)',
  'src-right': 'Right (out)',
  'src-bottom': 'Bottom (out)',
  'src-left': 'Left (out)',
  'tgt-top': 'Top (in)',
  'tgt-right': 'Right (in)',
  'tgt-bottom': 'Bottom (in)',
  'tgt-left': 'Left (in)',
}

export function edgeHandleLabel(handleId: string | null | undefined): string {
  if (!handleId) return ''
  return HANDLE_TO_LABEL[handleId] ?? handleId
}

export function edgeDocToReactFlowEdge(doc: EdgeDoc): Edge {
  const text =
    typeof doc.label === 'string' && doc.label.trim().length > 0 ? doc.label.trim() : undefined
  return {
    id: doc.id,
    source: doc.sourceNodeId,
    target: doc.targetNodeId,
    type: 'default',
    sourceHandle: doc.sourceHandle ?? DEFAULT_SOURCE_HANDLE,
    targetHandle: doc.targetHandle ?? DEFAULT_TARGET_HANDLE,
    ...(text ? { label: text } : {}),
  }
}
