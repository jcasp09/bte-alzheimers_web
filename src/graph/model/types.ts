// Keep this file read-only exports

export type GraphId = 'context' | 'tasks'

export const GRAPH_IDS = { context: 'context', tasks: 'tasks' } as const

export type NodeType = 'person' | 'place' | 'task' | 'group'
export type PickableNode = {
  id: string
  type: NodeType
  name: string
}

/** Firestore document shape for a node. Optional fields vary by `type`. */
export type NodeDoc = {
  id: string
  type: NodeType
  name: string
  position?: { x: number; y: number }
  /** When set, this node is laid out inside the parent group (context graph). */
  parentId?: string
  width?: number
  height?: number
  relationship?: string
  email?: string
  phone?: string
  photoPath?: string
  photoUpdatedAt?: string
  address?: string
  title?: string
  startAt?: string
  endAt?: string
  calendarEventId?: string
  priority?: number
  location?: string
}

/** Firestore document shape for an edge. */
export type EdgeDoc = {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

/** Persisted ReactFlow viewport (pan + zoom) for restoring on reload. */
export type GraphViewport = {
  x: number
  y: number
  zoom: number
}
