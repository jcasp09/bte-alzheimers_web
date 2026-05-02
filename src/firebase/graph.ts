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
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db } from './firestore'
import { storage } from './storage'

export type GraphId = 'context' | 'tasks'
export type NodeType = 'person' | 'place' | 'task' | 'group'

export type PickableNode = {
  id: string
  type: NodeType
  name: string
}

export const PERSON_NODE_DEFAULT_SIZE = { width: 220, height: 100 } as const
export const PLACE_NODE_DEFAULT_SIZE = { width: 120, height: 100 } as const
export const GROUP_NODE_DEFAULT_SIZE = { width: 400, height: 300 } as const

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
}

export type CreatePlaceNodeData = {
  type: 'place'
  name: string
  address: string
  width?: number
  height?: number
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

function randomOffset() {
  return Math.round((Math.random() - 0.5) * 80)
}

export async function createNode(
  uid: string,
  data: CreateNodeData,
  graphId: GraphId = 'context',
): Promise<string> {
  let position = { x: randomOffset(), y: randomOffset() }
  const base = omitUndefinedFields(data) as Record<string, unknown>
  if (data.type === 'group') {
    const w = data.width ?? GROUP_NODE_DEFAULT_SIZE.width
    const h = data.height ?? GROUP_NODE_DEFAULT_SIZE.height
    base.width = w
    base.height = h
    const p = data.position
    if (
      p &&
      typeof p.x === 'number' &&
      typeof p.y === 'number' &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y)
    ) {
      position = { x: p.x, y: p.y }
    }
    delete base.position
  }
  const docRef = await addDoc(collection(db, 'users', uid, 'graphs', graphId, 'nodes'), {
    ...base,
    position,
  })
  return docRef.id
}

export async function upsertNode(
  uid: string,
  nodeId: string,
  data: CreateNodeData,
  graphId: GraphId = 'context',
): Promise<string> {
  const nodeRef = doc(db, 'users', uid, 'graphs', graphId, 'nodes', nodeId)
  await setDoc(nodeRef, omitUndefinedFields(data), { merge: true })
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
  graphId: GraphId = 'context',
  options?: CreateEdgeOptions,
): Promise<string> {
  const label =
    typeof options?.label === 'string' && options.label.trim().length > 0
      ? options.label.trim()
      : undefined
  const docRef = await addDoc(
    collection(db, 'users', uid, 'graphs', graphId, 'edges'),
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

type UploadNodePhotoResult = {
  photoPath: string
  photoUrl: string
  photoUpdatedAt: string
}

function personPhotoPath(uid: string, graphId: GraphId, nodeId: string): string {
  return `users/${uid}/graphs/${graphId}/nodes/${nodeId}/photo`
}

export async function uploadPersonNodePhoto(
  uid: string,
  nodeId: string,
  file: File,
  graphId: GraphId = 'context',
): Promise<UploadNodePhotoResult> {
  const path = personPhotoPath(uid, graphId, nodeId)
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

export type EdgeDoc = {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

export type GraphViewport = {
  x: number
  y: number
  zoom: number
}

export type StaleTaskCleanupResult = {
  removedTaskNodes: number
  removedEdges: number
}

export async function getNodes(uid: string, graphId: GraphId = 'context'): Promise<NodeDoc[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'graphs', graphId, 'nodes'))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NodeDoc[]
}

export async function getEdges(uid: string, graphId: GraphId = 'context'): Promise<EdgeDoc[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'graphs', graphId, 'edges'))
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

export async function saveNodePositions(
  uid: string,
  nodes: NodeLayoutRow[],
  graphId: GraphId = 'context',
): Promise<void> {
  if (nodes.length === 0) return
  // Only update docs that still exist. setDoc(..., { merge: true }) on a deleted id
  // would recreate an empty node (position-only), which shows as blank "()" on the graph
  // when DefaultFlow unmounts with stale React Flow state after a delete.
  const col = collection(db, 'users', uid, 'graphs', graphId, 'nodes')
  const snapshot = await getDocs(col)
  const existingIds = new Set(snapshot.docs.map((d) => d.id))
  const toSave = nodes.filter((n) => existingIds.has(n.id))
  if (toSave.length === 0) return
  const batch = writeBatch(db)
  toSave.forEach((node) => {
    const ref = doc(db, 'users', uid, 'graphs', graphId, 'nodes', node.id)
    const patch: Record<string, unknown> = { position: node.position }
    if (node.parentId === null) {
      patch.parentId = deleteField()
    } else if (typeof node.parentId === 'string') {
      patch.parentId = node.parentId
    }
    batch.set(ref, patch, { merge: true })
  })
  await batch.commit()
}

export async function saveGraphViewport(
  uid: string,
  viewport: GraphViewport,
  graphId: GraphId = 'context',
): Promise<void> {
  const ref = doc(db, 'users', uid, 'graphs', graphId, 'meta', 'viewport')
  await setDoc(
    ref,
    {
      viewport,
    },
    { merge: true },
  )
}

export async function getGraphViewport(
  uid: string,
  graphId: GraphId = 'context',
): Promise<GraphViewport | null> {
  const ref = doc(db, 'users', uid, 'graphs', graphId, 'meta', 'viewport')
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as { viewport?: GraphViewport }
  return data.viewport ?? null
}

export async function deleteEdge(
  uid: string,
  edgeId: string,
  graphId: GraphId = 'context',
): Promise<void> {
  const edgeRef = doc(db, 'users', uid, 'graphs', graphId, 'edges', edgeId)
  await deleteDoc(edgeRef)
}

/** Persist or clear the edge label (`null` or empty string removes the field). */
export async function updateEdgeLabel(
  uid: string,
  edgeId: string,
  label: string | null,
  graphId: GraphId = 'context',
): Promise<void> {
  const edgeRef = doc(db, 'users', uid, 'graphs', graphId, 'edges', edgeId)
  const trimmed = typeof label === 'string' ? label.trim() : ''
  if (trimmed.length === 0) {
    await setDoc(edgeRef, { label: deleteField() }, { merge: true })
  } else {
    await setDoc(edgeRef, { label: trimmed }, { merge: true })
  }
}

export async function deleteNodeAndEdges(
  uid: string,
  nodeId: string,
  graphId: GraphId = 'context',
): Promise<void> {
  const nodeRef = doc(db, 'users', uid, 'graphs', graphId, 'nodes', nodeId)
  const nodeSnap = await getDoc(nodeRef)
  const nodeData = (nodeSnap.exists() ? nodeSnap.data() : null) as {
    photoPath?: string
    type?: NodeType
    position?: { x: number; y: number }
  } | null

  if (nodeData?.type === 'group' && nodeSnap.exists()) {
    const nodesCol = collection(db, 'users', uid, 'graphs', graphId, 'nodes')
    const parentPos = nodeData.position ?? { x: 0, y: 0 }
    const childrenSnap = await getDocs(query(nodesCol, where('parentId', '==', nodeId)))
    if (!childrenSnap.empty) {
      const detachBatch = writeBatch(db)
      childrenSnap.forEach((childDoc) => {
        const childRef = childDoc.ref
        const rel = (childDoc.data().position as { x: number; y: number } | undefined) ?? {
          x: 0,
          y: 0,
        }
        const abs = { x: parentPos.x + rel.x, y: parentPos.y + rel.y }
        detachBatch.set(
          childRef,
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

  const edgesCol = collection(db, 'users', uid, 'graphs', graphId, 'edges')
  const [sourceSnap, targetSnap] = await Promise.all([
    getDocs(query(edgesCol, where('sourceNodeId', '==', nodeId))),
    getDocs(query(edgesCol, where('targetNodeId', '==', nodeId))),
  ])

  const edgeIds = new Set<string>()
  sourceSnap.forEach((d) => edgeIds.add(d.id))
  targetSnap.forEach((d) => edgeIds.add(d.id))

  await Promise.all(
    Array.from(edgeIds).map((edgeId) =>
      deleteDoc(doc(db, 'users', uid, 'graphs', graphId, 'edges', edgeId)),
    ),
  )

  if (typeof nodeData?.photoPath === 'string' && nodeData.photoPath.length > 0) {
    try {
      await deletePersonNodePhotoByPath(nodeData.photoPath)
    } catch (error) {
      // File may already be missing; node/edge deletion should still succeed.
      console.warn('Failed to delete person node photo from storage', error)
    }
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

  const allNodes = await getNodes(uid, 'tasks')
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
  const allEdges = await getEdges(uid, 'tasks')
  const staleEdgeIds = allEdges
    .filter((edge) => staleIdSet.has(edge.sourceNodeId) || staleIdSet.has(edge.targetNodeId))
    .map((edge) => edge.id)

  const refsToDelete = [
    ...staleTaskIds.map((id) => doc(db, 'users', uid, 'graphs', 'tasks', 'nodes', id)),
    ...staleEdgeIds.map((id) => doc(db, 'users', uid, 'graphs', 'tasks', 'edges', id)),
  ]

  // Firestore batched writes allow up to 500 operations per commit.
  for (let i = 0; i < refsToDelete.length; i += 500) {
    const batch = writeBatch(db)
    refsToDelete.slice(i, i + 500).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  return {
    removedTaskNodes: staleTaskIds.length,
    removedEdges: staleEdgeIds.length,
  }
}
