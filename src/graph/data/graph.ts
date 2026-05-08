import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db } from '../../firebase/firestore'
import { storage } from '../../firebase/storage'
import { removeMemoryReferencesToDeletedNode } from '../../memories/data/memories'
import { GROUP_NODE_DEFAULT_SIZE } from '../model/dimensions'
import type {
  EdgeDoc,
  GraphId,
  GraphViewport,
  NodeDoc,
  NodeType,
} from '../model/types'

export const GRAPH_IDS = { context: 'context', tasks: 'tasks' } as const

// Allowed photo MIME types for person nodes
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'] as const
export const PHOTO_ACCEPT_ATTR = PHOTO_MIME_TYPES.join(',')
export const PHOTO_TYPE_LABEL = 'JPEG/PNG'

export function isAllowedPhotoType(file: File): boolean {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(file.type)
}

// Firestore path builders
function nodesCollection(uid: string, graphId: GraphId): CollectionReference {
  return collection(db, 'users', uid, 'graphs', graphId, 'nodes')
}
function edgesCollection(uid: string, graphId: GraphId): CollectionReference {
  return collection(db, 'users', uid, 'graphs', graphId, 'edges')
}
function nodeDocRef(uid: string, graphId: GraphId, nodeId: string): DocumentReference {
  return doc(nodesCollection(uid, graphId), nodeId)
}
function edgeDocRef(uid: string, graphId: GraphId, edgeId: string): DocumentReference {
  return doc(edgesCollection(uid, graphId), edgeId)
}
function viewportDocRef(uid: string, graphId: GraphId): DocumentReference {
  return doc(db, 'users', uid, 'graphs', graphId, 'meta', 'viewport')
}
function nodePhotoStoragePath(uid: string, graphId: GraphId, nodeId: string): string {
  return `users/${uid}/graphs/${graphId}/nodes/${nodeId}/photo`
}

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

export type CreateNodeData = CreatePersonNodeData | CreatePlaceNodeData | CreateTaskNodeData | CreateGroupNodeData

/** Firestore rejects `undefined` in document payloads. */
function omitUndefinedFields(obj: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

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

export type CreateEdgeOptions = {
  sourceHandle?: string
  targetHandle?: string
  /** Optional text shown on the edge in the graph UI. */
  label?: string
}

export async function createEdge(
  uid: string,
  sourceNodeId: string,
  targetNodeId: string,
  graphId: GraphId = GRAPH_IDS.context,
  options?: CreateEdgeOptions,
): Promise<string> {
  const label =
    typeof options?.label === 'string' && options.label.trim().length > 0
      ? options.label.trim()
      : undefined
  const docRef = await addDoc(
    edgesCollection(uid, graphId),
    omitUndefinedFields({
      sourceNodeId,
      targetNodeId,
      sourceHandle: options?.sourceHandle,
      targetHandle: options?.targetHandle,
      label,
    }),
  )
  return docRef.id
}

type UploadNodePhotoResult = {
  photoPath: string
  photoUrl: string
  photoUpdatedAt: string
}

export async function uploadPersonNodePhoto(
  uid: string,
  nodeId: string,
  file: File,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<UploadNodePhotoResult> {
  const path = nodePhotoStoragePath(uid, graphId, nodeId)
  const photoRef = ref(storage, path)
  await uploadBytes(photoRef, file, { contentType: file.type })
  const photoUrl = await getDownloadURL(photoRef)
  return {
    photoPath: path,
    photoUrl,
    photoUpdatedAt: new Date().toISOString(),
  }
}

export async function deletePersonNodePhotoByPath(photoPath: string): Promise<void> {
  const photoRef = ref(storage, photoPath)
  await deleteObject(photoRef)
}

export type StaleTaskCleanupResult = {
  removedTaskNodes: number
  removedEdges: number
}

export async function getNodes(uid: string, graphId: GraphId = GRAPH_IDS.context): Promise<NodeDoc[]> {
  const snapshot = await getDocs(nodesCollection(uid, graphId))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NodeDoc[]
}

export async function getEdges(uid: string, graphId: GraphId = GRAPH_IDS.context): Promise<EdgeDoc[]> {
  const snapshot = await getDocs(edgesCollection(uid, graphId))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EdgeDoc[]
}

export type NodeLayoutRow = {
  id: string
  position: { x: number; y: number }
  /** Omit to leave unchanged; `null` removes parentId in Firestore. */
  parentId?: string | null
}

/** Firestore batched writes allow up to this many operations per commit. */
const FIRESTORE_BATCH_LIMIT = 500

export async function saveNodePositions(
  uid: string,
  nodes: NodeLayoutRow[],
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  if (nodes.length === 0) return
  // Only update docs that still exist. setDoc(..., { merge: true }) on a deleted id
  // would recreate an empty node (position-only), which shows as blank "()" on the graph
  // when DefaultFlow unmounts with stale React Flow state after a delete.
  const snapshot = await getDocs(nodesCollection(uid, graphId))
  const existingIds = new Set(snapshot.docs.map((d) => d.id))
  const toSave = nodes.filter((n) => existingIds.has(n.id))
  if (toSave.length === 0)
    return

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

export async function saveGraphViewport(
  uid: string,
  viewport: GraphViewport,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  await setDoc(viewportDocRef(uid, graphId), { viewport }, { merge: true })
}

export async function getGraphViewport(
  uid: string,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<GraphViewport | null> {
  const snap = await getDoc(viewportDocRef(uid, graphId))
  if (!snap.exists())
    return null

  const data = snap.data() as { viewport?: GraphViewport }
  return data.viewport ?? null
}

export async function deleteEdge(
  uid: string,
  edgeId: string,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  await deleteDoc(edgeDocRef(uid, graphId, edgeId))
}

/** Persist or clear the edge label (`null` or empty string removes the field). */
export async function updateEdgeLabel(
  uid: string,
  edgeId: string,
  label: string | null,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  const ref = edgeDocRef(uid, graphId, edgeId)
  const trimmed = typeof label === 'string' ? label.trim() : ''
  const labelObj = { label: trimmed.length === 0 ? deleteField() : trimmed }
  await setDoc(ref, labelObj, { merge: true })
}

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
      await deletePersonNodePhotoByPath(nodeData.photoPath)
    } catch (error) {
      // File may already be missing; node/edge deletion should still succeed.
      console.warn('Failed to delete person node photo from storage', error)
    }
  }

  if (graphId === 'context') {
    await removeMemoryReferencesToDeletedNode(uid, nodeId)
  }
}

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
