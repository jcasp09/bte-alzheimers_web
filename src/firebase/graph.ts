import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firestore'

export type GraphId = 'context' | 'tasks'
export type NodeType = 'person' | 'place' | 'task'

export type CreatePersonNodeData = {
  type: 'person'
  name: string
  relationship: string
  email?: string
  phone?: string
}

export type CreatePlaceNodeData = {
  type: 'place'
  name: string
  address: string
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

export type CreateNodeData = CreatePersonNodeData | CreatePlaceNodeData | CreateTaskNodeData

function randomOffset() {
  return Math.round((Math.random() - 0.5) * 80)
}

export async function createNode(
  uid: string,
  data: CreateNodeData,
  graphId: GraphId = 'context',
): Promise<string> {
  const position = { x: randomOffset(), y: randomOffset() }
  const docRef = await addDoc(collection(db, 'users', uid, 'graphs', graphId, 'nodes'), {
    ...data,
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
  await setDoc(nodeRef, data, { merge: true })
  return nodeId
}

export async function createEdge(
  uid: string,
  sourceNodeId: string,
  targetNodeId: string,
  graphId: GraphId = 'context',
): Promise<string> {
  const docRef = await addDoc(collection(db, 'users', uid, 'graphs', graphId, 'edges'), {
    sourceNodeId,
    targetNodeId,
  })
  return docRef.id
}

export type NodeDoc = {
  id: string
  type: NodeType
  name: string
  position?: { x: number; y: number }
  relationship?: string
  email?: string
  phone?: string
  address?: string
  title?: string
  startAt?: string
  endAt?: string
  calendarEventId?: string
  priority?: number
  location?: string
}

export type EdgeDoc = {
  id: string
  sourceNodeId: string
  targetNodeId: string
}

export type GraphViewport = {
  x: number
  y: number
  zoom: number
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

export async function saveNodePositions(
  uid: string,
  nodes: { id: string; position: { x: number; y: number } }[],
  graphId: GraphId = 'context',
): Promise<void> {
  if (nodes.length === 0) return
  const batch = writeBatch(db)
  nodes.forEach((node) => {
    const ref = doc(db, 'users', uid, 'graphs', graphId, 'nodes', node.id)
    batch.set(
      ref,
      {
        position: node.position,
      },
      { merge: true },
    )
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

export async function deleteNodeAndEdges(
  uid: string,
  nodeId: string,
  graphId: GraphId = 'context',
): Promise<void> {
  const nodeRef = doc(db, 'users', uid, 'graphs', graphId, 'nodes', nodeId)
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
}
