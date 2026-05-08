import {
  addDoc,
  deleteDoc,
  deleteField,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { GRAPH_IDS, type EdgeDoc, type GraphId } from '../model/types'
import { edgeDocRef, edgesCollection, omitUndefinedFields } from './_paths'

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

export async function getEdges(uid: string, graphId: GraphId = GRAPH_IDS.context): Promise<EdgeDoc[]> {
  const snapshot = await getDocs(edgesCollection(uid, graphId))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EdgeDoc[]
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
