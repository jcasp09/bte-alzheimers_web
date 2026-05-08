import type { Edge, Node } from '@xyflow/react'
import { GRAPH_TRANSLATE_EXTENT, type Layer, type XY } from '../../../graph/model/flowConstants'
import { GROUP_DRAW_BOUNDS, GROUP_NODE_DEFAULT_SIZE } from '../../../graph/model/dimensions'
import { edgeDocToReactFlowEdge } from '../../../graph/model/edgeHandles'
import type { EdgeDoc, NodeDoc, NodeType } from '../../../graph/model/types'

/** Context graph displays only relationship-layer node types. */
export const CONTEXT_GRAPH_NODE_TYPES = new Set<NodeType>(['person', 'place', 'group'])

/** Filter map for which relationship-layer node types are visible. */
export type VisibleTypes = { person: boolean; place: boolean; group: boolean }

export const DEFAULT_VISIBLE_TYPES: VisibleTypes = { person: true, place: true, group: true }

/** Build a normalized rect from two corner points, clamped to the group draw bounds. */
export function rectFromCorners(p1: XY, p2: XY): { x: number; y: number; width: number; height: number } {
  const x = Math.min(p1.x, p2.x)
  const y = Math.min(p1.y, p2.y)
  const width = Math.min(GROUP_DRAW_BOUNDS.max, Math.max(GROUP_DRAW_BOUNDS.minW, Math.abs(p2.x - p1.x)))
  const height = Math.min(GROUP_DRAW_BOUNDS.max, Math.max(GROUP_DRAW_BOUNDS.minH, Math.abs(p2.y - p1.y)))
  return { x, y, width, height }
}

/** Sort docs so groups render before their children in React Flow's parent-aware layout. */
export function sortContextGraphDocs(docs: NodeDoc[]): NodeDoc[] {
  const inScope = docs.filter((d) => CONTEXT_GRAPH_NODE_TYPES.has(d.type))
  const roots = inScope.filter((d) => !d.parentId)
  const children = inScope.filter((d) => d.parentId)
  roots.sort((a, b) => {
    const ag = a.type === 'group' ? 0 : 1
    const bg = b.type === 'group' ? 0 : 1
    if (ag !== bg) return ag - bg
    return a.id.localeCompare(b.id)
  })
  children.sort((a, b) => {
    const p = (a.parentId ?? '').localeCompare(b.parentId ?? '')
    if (p !== 0) return p
    return a.id.localeCompare(b.id)
  })
  return [...roots, ...children]
}

/** Convert a Firestore node doc into a React Flow Node, or null if its type is
 *  not part of the context (relationships) graph. */
export function docToReactFlowNode(doc: NodeDoc): Node | null {
  if (!CONTEXT_GRAPH_NODE_TYPES.has(doc.type)) return null

  if (doc.type === 'group') {
    const w =
      typeof doc.width === 'number' && Number.isFinite(doc.width)
        ? doc.width
        : GROUP_NODE_DEFAULT_SIZE.width
    const h =
      typeof doc.height === 'number' && Number.isFinite(doc.height)
        ? doc.height
        : GROUP_NODE_DEFAULT_SIZE.height
    return {
      id: doc.id,
      type: 'group',
      parentId: doc.parentId,
      position: doc.position ?? { x: 0, y: 0 },
      width: w,
      height: h,
      zIndex: -1,
      data: { name: doc.name },
    }
  }

  return {
    id: doc.id,
    type: doc.type,
    parentId: doc.parentId,
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
      width: typeof doc.width === 'number' && Number.isFinite(doc.width) ? doc.width : undefined,
      height: typeof doc.height === 'number' && Number.isFinite(doc.height) ? doc.height : undefined,
    },
    position: doc.position ?? { x: 0, y: 0 },
  }
}

export function firestoreNodesToReactFlow(nodes: NodeDoc[]): Node[] {
  return sortContextGraphDocs(nodes)
    .map(docToReactFlowNode)
    .filter((n): n is Node => n != null)
}

export function firestoreEdgesToReactFlow(edges: EdgeDoc[]): Edge[] {
  return edges.map(edgeDocToReactFlowEdge)
}

/** Four corner nodes that anchor the minimap to the full pannable extent. */
export const ANCHOR_NODES: Node[] = (() => {
  const [[minX, minY], [maxX, maxY]] = GRAPH_TRANSLATE_EXTENT
  const baseProps = {
    type: 'anchor',
    width: 1,
    height: 1,
    data: {},
    draggable: false,
    selectable: false,
    connectable: false,
    deletable: false,
    focusable: false,
  } as const
  return [
    { id: '__anchor_tl', position: { x: minX, y: minY }, ...baseProps },
    { id: '__anchor_tr', position: { x: maxX, y: minY }, ...baseProps },
    { id: '__anchor_bl', position: { x: minX, y: maxY }, ...baseProps },
    { id: '__anchor_br', position: { x: maxX, y: maxY }, ...baseProps },
  ]
})()

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
