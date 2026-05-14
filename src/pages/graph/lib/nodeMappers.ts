import type { Edge, Node } from '@xyflow/react'
import { type Layer } from '../../../graph/model/flowConstants'
import { CENTER_SOURCE_HANDLE_ID, CENTER_TARGET_HANDLE_ID } from '../../../graph/components/NodeEdgeHandles'
import type { EdgeDoc, NodeDoc, NodeType } from '../../../graph/model/types'

/** Context graph displays only relationship-layer node types. */
export const CONTEXT_GRAPH_NODE_TYPES = new Set<NodeType>(['person', 'place', 'self'])

/** Coerce a possibly-malformed stored position into a finite-number pair. */
function safePosition(p: { x?: number; y?: number } | undefined): { x: number; y: number } {
  const x = typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : 0
  const y = typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : 0
  return { x, y }
}

/** Convert a Firestore node doc into a React Flow Node, or null if its type is
 *  not part of the context (relationships) graph. */
export function docToReactFlowNode(doc: NodeDoc): Node | null {
  if (!CONTEXT_GRAPH_NODE_TYPES.has(doc.type)) return null

  if (doc.type === 'self') {
    return {
      id: doc.id,
      type: 'self',
      position: { x: 0, y: 0 },
      draggable: false,
      deletable: false,
      connectable: true,
      selectable: true,
      data: {},
    }
  }

  return {
    id: doc.id,
    type: doc.type,
    data: {
      name: doc.name,
      relationship: doc.relationship,
      email: doc.email,
      phone: doc.phone,
      address: doc.address,
      photoPath: doc.photoPath,
      photoUpdatedAt: doc.photoUpdatedAt,
      title: doc.title,
      startAt: doc.startAt,
      endAt: doc.endAt,
      calendarEventId: doc.calendarEventId,
      priority: doc.priority,
      location: doc.location,
      ringTier: typeof doc.ringTier === 'number' && Number.isFinite(doc.ringTier) ? doc.ringTier : undefined,
      width: typeof doc.width === 'number' && Number.isFinite(doc.width) ? doc.width : undefined,
      height: typeof doc.height === 'number' && Number.isFinite(doc.height) ? doc.height : undefined,
    },
    position: safePosition(doc.position),
  }
}

export function firestoreNodesToReactFlow(nodes: NodeDoc[]): Node[] {
  return nodes
    .filter((d) => CONTEXT_GRAPH_NODE_TYPES.has(d.type))
    .map(docToReactFlowNode)
    .filter((n): n is Node => n != null)
}

/** Convert a persisted EdgeDoc into a React Flow Edge. */
function edgeDocToReactFlowEdge(doc: EdgeDoc): Edge {
  const text =
    typeof doc.label === 'string' && doc.label.trim().length > 0 ? doc.label.trim() : undefined
  return {
    id: doc.id,
    source: doc.sourceNodeId,
    target: doc.targetNodeId,
    // Straight line between the two node centers; the opaque node backgrounds
    // mask the portion that passes underneath.
    type: 'straight',
    sourceHandle: CENTER_SOURCE_HANDLE_ID,
    targetHandle: CENTER_TARGET_HANDLE_ID,
    ...(text ? { label: text } : {}),
  }
}

export function firestoreEdgesToReactFlow(edges: EdgeDoc[]): Edge[] {
  return edges.map(edgeDocToReactFlowEdge)
}


/** Lower number = higher priority in the search dropdown. */
export function typePriority(type: string, layer: Layer): number {
  if (layer === 'memories') {
    return type === 'memory' ? 0 : 99
  }
  switch (type) {
    case 'person': return 0
    case 'place': return 1
    default: return 99
  }
}
