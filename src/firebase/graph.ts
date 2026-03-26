import { addDoc, collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from './firestore'

export type GraphId = 'context' | 'tasks'
export type NodeType = 'person' | 'place' | 'task'

export type CreatePersonNodeData = {
  type: 'person'
  name: string
  relationship: string
  email: string
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
