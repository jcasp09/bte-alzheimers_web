import type { Node } from '@xyflow/react'
import { GROUP_NODE_DEFAULT_SIZE, safeNodeDimensions } from './dimensions'

/** Top-left of `node` in flow coordinates (sums parent chain positions). */
export function getFlowAbsolutePosition(node: Node, all: Node[]): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let cur: Node | undefined = node
  const seen = new Set<string>()
  for (;;) {
    if (!cur?.parentId) break
    const pid: string = cur.parentId
    if (seen.has(cur.id)) break
    seen.add(cur.id)
    const parent: Node | undefined = all.find((n) => n.id === pid)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    cur = parent
  }
  return { x, y }
}

function nodeMeasuredSize(n: Node): { w: number; h: number } {
  if (n.type === 'group') {
    return {
      w: n.width ?? GROUP_NODE_DEFAULT_SIZE.width,
      h: n.height ?? GROUP_NODE_DEFAULT_SIZE.height,
    }
  }
  if (n.type === 'person' || n.type === 'place') {
    const d = safeNodeDimensions(n.type, n.data.width, n.data.height)
    return { w: d.width, h: d.height }
  }
  return { w: 120, h: 80 }
}

function centerAbsolute(n: Node, all: Node[]): { x: number; y: number } {
  const topLeft = getFlowAbsolutePosition(n, all)
  const { w, h } = nodeMeasuredSize(n)
  return { x: topLeft.x + w / 2, y: topLeft.y + h / 2 }
}

function rootGroups(all: Node[]): Node[] {
  return all.filter((n) => n.type === 'group' && !n.parentId)
}

/** Smallest-area group whose bounds contain the given center (flow space). */
function findContainingGroup(center: { x: number; y: number }, draggedId: string, all: Node[]): Node | null {
  let best: Node | null = null
  let bestArea = Infinity
  for (const g of rootGroups(all)) {
    if (g.id === draggedId) continue
    const abs = getFlowAbsolutePosition(g, all)
    const { w, h } = nodeMeasuredSize(g)
    const { x, y } = center
    if (x >= abs.x && x <= abs.x + w && y >= abs.y && y <= abs.y + h) {
      const area = w * h
      if (area < bestArea) {
        best = g
        bestArea = area
      }
    }
  }
  return best
}

/**
 * After a drag ends, assign `parentId` and convert `position` between absolute flow space
 * and parent-relative space. Only person/place nodes may be reparented; groups are unchanged.
 */
export function applyReparentOnDragStop(all: Node[], draggedId: string): Node[] {
  const dragged = all.find((n) => n.id === draggedId)
  if (!dragged || dragged.type === 'group') return all

  const center = centerAbsolute(dragged, all)
  const container = findContainingGroup(center, dragged.id, all)
  const newParentId = container?.id
  const oldParentId = dragged.parentId

  if (newParentId === oldParentId) return all

  if (newParentId) {
    const parent = all.find((n) => n.id === newParentId)
    if (!parent) return all
    const absTL = getFlowAbsolutePosition(dragged, all)
    const newPos = {
      x: absTL.x - parent.position.x,
      y: absTL.y - parent.position.y,
    }
    return all.map((n) => (n.id === draggedId ? { ...n, parentId: newParentId, position: newPos } : n))
  }

  if (oldParentId) {
    const parent = all.find((n) => n.id === oldParentId)
    if (!parent) return all
    const absTL = getFlowAbsolutePosition(dragged, all)
    return all.map((n) =>
      n.id === draggedId ? { ...n, parentId: undefined, position: absTL } : n,
    )
  }

  return all
}
