/** Internal Firestore path builders + tiny shared helpers. Not a public
 *  API: prefer importing from one of the per-aspect modules in this folder. */
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from '../../firebase/firestore'
import type { GraphId } from '../model/types'

export function nodesCollection(uid: string, graphId: GraphId): CollectionReference {
  return collection(db, 'users', uid, 'graphs', graphId, 'nodes')
}

export function edgesCollection(uid: string, graphId: GraphId): CollectionReference {
  return collection(db, 'users', uid, 'graphs', graphId, 'edges')
}

export function nodeDocRef(uid: string, graphId: GraphId, nodeId: string): DocumentReference {
  return doc(nodesCollection(uid, graphId), nodeId)
}

export function edgeDocRef(uid: string, graphId: GraphId, edgeId: string): DocumentReference {
  return doc(edgesCollection(uid, graphId), edgeId)
}

export function viewportDocRef(uid: string, graphId: GraphId): DocumentReference {
  return doc(db, 'users', uid, 'graphs', graphId, 'meta', 'viewport')
}

export function nodePhotoStoragePath(uid: string, graphId: GraphId, nodeId: string): string {
  return `users/${uid}/graphs/${graphId}/nodes/${nodeId}/photo`
}

/** Firestore rejects `undefined` in document payloads, so strip them. */
export function omitUndefinedFields(obj: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

/** Firestore batched writes allow up to this many operations per commit. */
export const FIRESTORE_BATCH_LIMIT = 500
