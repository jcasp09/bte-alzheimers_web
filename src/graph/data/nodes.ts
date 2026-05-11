import {
  addDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase/firestore'
import { removeMemoryReferencesToDeletedNode } from '../../memories/data/memories'
import { GROUP_NODE_DEFAULT_SIZE } from '../model/dimensions'
import { GRAPH_IDS, type GraphId, type NodeDoc, type NodeType } from '../model/types'
import {
  edgeDocRef,
  edgesCollection,
  FIRESTORE_BATCH_LIMIT,
  nodeDocRef,
  nodesCollection,
  omitUndefinedFields,
} from './_paths'
import { deleteNodePhotoByPath } from './photos'
import { getEdges } from './edges'

export type CreatePersonNodeData = {
  type: 'person'
  name: string
  relationship: string
  email?: string
  phone?: string
  photoPath?: string
  photoUpdatedAt?: string
  width?: number
  height?: number
  position?: { x: number; y: number }
}

export type CreatePlaceNodeData = {
  type: 'place'
  name: string
  address: string
  photoPath?: string
  photoUpdatedAt?: string
  width?: number
  height?: number
  position?: { x: number; y: number }
}

export type CreateTaskNodeData = {
  type: 'task'
  name: string
  title: string
  startAt: string
  endAt: string
  calendarEventId: string
  priority: number
  location?: string
}

export type CreateGroupNodeData = {
  type: 'group'
  name: string
  width?: number
  height?: number
  /** When set (finite coords), the new group is created at this flow position instead of a random offset. */
  position?: { x: number; y: number }
}

export type CreateNodeData =
  | CreatePersonNodeData
  | CreatePlaceNodeData
  | CreateTaskNodeData
  | CreateGroupNodeData

/** Random spread (in flow units) used for new-node placement when no position is given. */
const RANDOM_PLACEMENT_SPREAD_PX = 80
function randomOffset(): number {
  return Math.round((Math.random() - 0.5) * RANDOM_PLACEMENT_SPREAD_PX)
}

export async function createNode(
  uid: string,
  data: CreateNodeData,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<string> {
  let position = { x: randomOffset(), y: randomOffset() }
  const base = omitUndefinedFields(data) as Record<string, unknown>

  const p = (data as { position?: { x: number; y: number } }).position
  if (p && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)) {
    position = { x: p.x, y: p.y }
  }
  delete base.position

  if (data.type === 'group') {
    base.width = data.width ?? GROUP_NODE_DEFAULT_SIZE.width
    base.height = data.height ?? GROUP_NODE_DEFAULT_SIZE.height
  }

  const docRef = await addDoc(nodesCollection(uid, graphId), {
    ...base,
    position,
  })
  return docRef.id
}

export async function upsertNode(
  uid: string,
  nodeId: string,
  data: CreateNodeData,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<string> {
  await setDoc(nodeDocRef(uid, graphId, nodeId), omitUndefinedFields(data), { merge: true })
  return nodeId
}

export async function saveNodeDimensions(
  uid: string,
  nodeId: string,
  width: number,
  height: number,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  await setDoc(nodeDocRef(uid, graphId, nodeId), { width, height }, { merge: true })
}

export async function clearNodePhoto(
  uid: string,
  nodeId: string,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  await setDoc(
    nodeDocRef(uid, graphId, nodeId),
    { photoPath: deleteField(), photoUpdatedAt: deleteField() },
    { merge: true },
  )
}

export async function getNodes(uid: string, graphId: GraphId = GRAPH_IDS.context): Promise<NodeDoc[]> {
  const snapshot = await getDocs(nodesCollection(uid, graphId))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NodeDoc[]
}

export type NodeLayoutRow = {
  id: string
  position: { x: number; y: number }
  /** Omit to leave unchanged; `null` removes parentId in Firestore. */
  parentId?: string | null
}

/** Bulk position writer used after drag-end. Skips IDs that no longer exist. */
export async function saveNodePositions(
  uid: string,
  nodes: NodeLayoutRow[],
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  if (nodes.length === 0) return
  const snapshot = await getDocs(nodesCollection(uid, graphId))
  const existingIds = new Set(snapshot.docs.map((d) => d.id))
  const toSave = nodes.filter((n) => existingIds.has(n.id))
  if (toSave.length === 0) return

  const batch = writeBatch(db)
  toSave.forEach((node) => {
    const patch: Record<string, unknown> = { position: node.position }
    if (node.parentId === null) {
      patch.parentId = deleteField()
    } else if (typeof node.parentId === 'string') {
      patch.parentId = node.parentId
    }
    batch.set(nodeDocRef(uid, graphId, node.id), patch, { merge: true })
  })
  await batch.commit()
}

/** Delete a node and its incident edges. For groups, children are detached and
 *  reparented at absolute coords first so they don't snap to the canvas origin.
 *  Photo blob and memory back-references are best-effort cleaned up afterward. */
export async function deleteNodeAndEdges(
  uid: string,
  nodeId: string,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  const nodeRef = nodeDocRef(uid, graphId, nodeId)
  const nodeSnap = await getDoc(nodeRef)
  const nodeData = (nodeSnap.exists() ? nodeSnap.data() : null) as {
    photoPath?: string
    type?: NodeType
    position?: { x: number; y: number }
  } | null

  if (nodeData?.type === 'group' && nodeSnap.exists()) {
    const parentPos = nodeData.position ?? { x: 0, y: 0 }
    const childrenSnap = await getDocs(
      query(nodesCollection(uid, graphId), where('parentId', '==', nodeId)),
    )
    if (!childrenSnap.empty) {
      const detachBatch = writeBatch(db)
      childrenSnap.forEach((childDoc) => {
        const rel = (childDoc.data().position as { x: number; y: number } | undefined) ?? {
          x: 0,
          y: 0,
        }
        const abs = { x: parentPos.x + rel.x, y: parentPos.y + rel.y }
        detachBatch.set(
          childDoc.ref,
          {
            parentId: deleteField(),
            position: abs,
          },
          { merge: true },
        )
      })
      await detachBatch.commit()
    }
  }

  await deleteDoc(nodeRef)

  const [sourceSnap, targetSnap] = await Promise.all([
    getDocs(query(edgesCollection(uid, graphId), where('sourceNodeId', '==', nodeId))),
    getDocs(query(edgesCollection(uid, graphId), where('targetNodeId', '==', nodeId))),
  ])

  const edgeIds = new Set<string>()
  sourceSnap.forEach((d) => edgeIds.add(d.id))
  targetSnap.forEach((d) => edgeIds.add(d.id))

  await Promise.all(
    Array.from(edgeIds).map((edgeId) => deleteDoc(edgeDocRef(uid, graphId, edgeId))),
  )

  if (typeof nodeData?.photoPath === 'string' && nodeData.photoPath.length > 0) {
    try {
      await deleteNodePhotoByPath(nodeData.photoPath)
    } catch (error) {
      // File may already be missing; node/edge deletion should still succeed.
      console.warn('Failed to delete node photo from storage', error)
    }
  }

  if (graphId === 'context') {
    await removeMemoryReferencesToDeletedNode(uid, nodeId)
  }
}

export type StaleTaskCleanupResult = {
  removedTaskNodes: number
  removedEdges: number
}

/** Sweep: delete task nodes whose `endAt` is before `nowIso`, plus any edges
 *  that incident on them. Operates only on the tasks graph. */
export async function removePassedTaskNodes(
  uid: string,
  nowIso: string = new Date().toISOString(),
): Promise<StaleTaskCleanupResult> {
  const nowMs = new Date(nowIso).getTime()
  if (Number.isNaN(nowMs)) {
    return { removedTaskNodes: 0, removedEdges: 0 }
  }

  const allNodes = await getNodes(uid, GRAPH_IDS.tasks)
  const staleTaskIds = allNodes
    .filter((node) => {
      if (node.type !== 'task' || typeof node.endAt !== 'string') return false
      const endMs = new Date(node.endAt).getTime()
      return !Number.isNaN(endMs) && endMs < nowMs
    })
    .map((node) => node.id)

  if (staleTaskIds.length === 0) {
    return { removedTaskNodes: 0, removedEdges: 0 }
  }

  const staleIdSet = new Set(staleTaskIds)
  const allEdges = await getEdges(uid, GRAPH_IDS.tasks)
  const staleEdgeIds = allEdges
    .filter((edge) => staleIdSet.has(edge.sourceNodeId) || staleIdSet.has(edge.targetNodeId))
    .map((edge) => edge.id)

  const refsToDelete = [
    ...staleTaskIds.map((id) => nodeDocRef(uid, GRAPH_IDS.tasks, id)),
    ...staleEdgeIds.map((id) => edgeDocRef(uid, GRAPH_IDS.tasks, id)),
  ]

  for (let i = 0; i < refsToDelete.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db)
    refsToDelete.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  return {
    removedTaskNodes: staleTaskIds.length,
    removedEdges: staleEdgeIds.length,
  }
}
