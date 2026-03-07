import { addDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firestore'

export type NodeType = 'person' | 'place'

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

export type CreateNodeData = CreatePersonNodeData | CreatePlaceNodeData

function randomOffset() {
  return Math.round((Math.random() - 0.5) * 80)
}

export async function createNode(
  uid: string,
  data: CreateNodeData,
): Promise<string> {
  const position = { x: randomOffset(), y: randomOffset() }
  const docRef = await addDoc(collection(db, 'users', uid, 'nodes'), {
    ...data,
    position,
  })
  return docRef.id
}

export async function createEdge(
  uid: string,
  sourceNodeId: string,
  targetNodeId: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, 'users', uid, 'edges'), {
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
}

export type EdgeDoc = {
  id: string
  sourceNodeId: string
  targetNodeId: string
}

export async function getNodes(uid: string): Promise<NodeDoc[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'nodes'))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NodeDoc[]
}

export async function getEdges(uid: string): Promise<EdgeDoc[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'edges'))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EdgeDoc[]
}
