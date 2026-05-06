import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  documentId,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { db } from '../services/firestore'
import { storage } from '../services/storage'

export const MAX_PEOPLE_PER_MOMENT = 10
export const MAX_PLACES_PER_MOMENT = 4
export const MAX_PHOTOS_PER_MOMENT = 10

export function parseOccurredOn(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const y = +m[1]
  const month = +m[2]
  const d = +m[3]
  if (month < 1 || month > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, month - 1, d))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null
  }
  return { y, m: month, d }
}

export function formatOccurredOnDate(y: number, month: number, day: number): string {
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export type MomentDoc = {
  id: string
  title: string
  description: string
  occurredOn: string
  personNodeIds: string[]
  placeNodeIds: string[]
  /** Storage object paths under `users/{uid}/moments/{momentId}/…` */
  photoPaths: string[]
  createdAt: Timestamp | null
}

export type CreateMomentInput = {
  title: string
  description: string
  occurredOn: string
  personNodeIds: string[]
  placeNodeIds: string[]
}

export type UpdateMomentInput = Partial<{
  title: string
  description: string
  occurredOn: string
  personNodeIds: string[]
  placeNodeIds: string[]
  photoPaths: string[]
}>

function momentsCollection(uid: string) {
  return collection(db, 'users', uid, 'moments')
}

async function validateContextNodeIdsByType(
  uid: string,
  ids: string[],
  expectedType: 'person' | 'place',
): Promise<void> {
  if (ids.length === 0) return
  const uniqueIds = [...new Set(ids)]
  const nodesCol = collection(db, 'users', uid, 'graphs', 'context', 'nodes')
  const QUERY_MAX = 10
  const validIds = new Set<string>()

  for (let i = 0; i < uniqueIds.length; i += QUERY_MAX) {
    const chunk = uniqueIds.slice(i, i + QUERY_MAX)
    const snap = await getDocs(query(nodesCol, where(documentId(), 'in', chunk)))
    snap.forEach((d) => {
      const data = d.data() as { type?: string }
      if (data.type === expectedType) {
        validIds.add(d.id)
      }
    })
  }

  if (validIds.size !== uniqueIds.length) {
    throw new Error(`One or more selected ${expectedType} references are invalid.`)
  }
}

function normalizePhotoPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) return []
  return paths
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .slice(0, MAX_PHOTOS_PER_MOMENT)
}

function validateMomentPhotoPaths(uid: string, momentId: string, paths: string[]): void {
  const prefix = `users/${uid}/moments/${momentId}/`
  for (const p of paths) {
    if (!p.startsWith(prefix)) {
      throw new Error('Invalid photo path for this moment.')
    }
  }
}

/** Richness score for layout at day/moment level (not used for year/month buckets). */
export function momentRichnessScore(m: Pick<MomentDoc, 'title' | 'description' | 'personNodeIds' | 'placeNodeIds' | 'photoPaths'>): number {
  const people = m.personNodeIds?.length ?? 0
  const places = m.placeNodeIds?.length ?? 0
  const photos = m.photoPaths?.length ?? 0
  const descLen = (m.description ?? '').trim().length
  const descTerm = Math.min(descLen / 200, 1) * 2
  const titleBonus = (m.title ?? '').trim().length > 0 ? 0.5 : 0
  return people + places + photos * 1.5 + descTerm + titleBonus
}

async function assertSingleMomentPerDay(uid: string, occurredOn: string, excludeMomentId?: string): Promise<void> {
  const snap = await getDocs(query(momentsCollection(uid), where('occurredOn', '==', occurredOn)))
  for (const d of snap.docs) {
    if (excludeMomentId && d.id === excludeMomentId) continue
    throw new Error('You already have a moment on this date. Only one moment per day is allowed.')
  }
}

export async function getMoments(uid: string): Promise<MomentDoc[]> {
  const snapshot = await getDocs(momentsCollection(uid))
  return snapshot.docs.map((d) => {
    const data = d.data() as Omit<MomentDoc, 'id' | 'createdAt'> & { createdAt?: Timestamp }
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : null
    return {
      id: d.id,
      title: data.title ?? '',
      description: data.description ?? '',
      occurredOn: data.occurredOn ?? '',
      personNodeIds: Array.isArray(data.personNodeIds) ? data.personNodeIds : [],
      placeNodeIds: Array.isArray(data.placeNodeIds) ? data.placeNodeIds : [],
      photoPaths: normalizePhotoPaths(data.photoPaths),
      createdAt,
    }
  })
}

export async function createMoment(uid: string, input: CreateMomentInput): Promise<string> {
  if (!parseOccurredOn(input.occurredOn)) {
    throw new Error('Choose a valid date.')
  }
  await assertSingleMomentPerDay(uid, input.occurredOn)
  const personNodeIds = [...new Set(input.personNodeIds)].slice(0, MAX_PEOPLE_PER_MOMENT)
  const placeNodeIds = [...new Set(input.placeNodeIds)].slice(0, MAX_PLACES_PER_MOMENT)
  await Promise.all([
    validateContextNodeIdsByType(uid, personNodeIds, 'person'),
    validateContextNodeIdsByType(uid, placeNodeIds, 'place'),
  ])
  const docRef = await addDoc(momentsCollection(uid), {
    title: input.title,
    description: input.description,
    occurredOn: input.occurredOn,
    personNodeIds,
    placeNodeIds,
    photoPaths: [],
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateMoment(
  uid: string,
  momentId: string,
  patch: UpdateMomentInput,
): Promise<void> {
  const ref = doc(db, 'users', uid, 'moments', momentId)
  const payload: Record<string, unknown> = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.occurredOn !== undefined) {
    if (!parseOccurredOn(patch.occurredOn)) {
      throw new Error('Use a valid calendar date (YYYY-MM-DD).')
    }
    await assertSingleMomentPerDay(uid, patch.occurredOn, momentId)
    payload.occurredOn = patch.occurredOn
  }
  if (patch.personNodeIds !== undefined) {
    const personNodeIds = [...new Set(patch.personNodeIds)].slice(0, MAX_PEOPLE_PER_MOMENT)
    await validateContextNodeIdsByType(uid, personNodeIds, 'person')
    payload.personNodeIds = personNodeIds
  }
  if (patch.placeNodeIds !== undefined) {
    const placeNodeIds = [...new Set(patch.placeNodeIds)].slice(0, MAX_PLACES_PER_MOMENT)
    await validateContextNodeIdsByType(uid, placeNodeIds, 'place')
    payload.placeNodeIds = placeNodeIds
  }
  if (patch.photoPaths !== undefined) {
    const photoPaths = normalizePhotoPaths(patch.photoPaths)
    validateMomentPhotoPaths(uid, momentId, photoPaths)
    payload.photoPaths = photoPaths
  }
  if (Object.keys(payload).length === 0) return
  await updateDoc(ref, payload)
}

export async function deleteMoment(uid: string, momentId: string): Promise<void> {
  const refDoc = doc(db, 'users', uid, 'moments', momentId)
  const snap = await getDoc(refDoc)
  const paths = snap.exists()
    ? normalizePhotoPaths((snap.data() as { photoPaths?: unknown }).photoPaths)
    : []
  await Promise.all(
    paths.map((p) =>
      deleteObject(ref(storage, p)).catch(() => {
        /* object may already be gone */
      }),
    ),
  )
  await deleteDoc(refDoc)
}

/** After a person or place graph node is removed, strip its id from all moments. */
export async function removeMomentReferencesToDeletedNode(uid: string, nodeId: string): Promise<void> {
  const col = momentsCollection(uid)
  const [snapPerson, snapPlace] = await Promise.all([
    getDocs(query(col, where('personNodeIds', 'array-contains', nodeId))),
    getDocs(query(col, where('placeNodeIds', 'array-contains', nodeId))),
  ])

  const updates: { ref: ReturnType<typeof doc>; field: 'personNodeIds' | 'placeNodeIds' }[] = []
  snapPerson.docs.forEach((d) =>
    updates.push({ ref: d.ref, field: 'personNodeIds' }),
  )
  snapPlace.docs.forEach((d) =>
    updates.push({ ref: d.ref, field: 'placeNodeIds' }),
  )

  const BATCH_MAX = 450
  for (let i = 0; i < updates.length; i += BATCH_MAX) {
    const batch = writeBatch(db)
    const chunk = updates.slice(i, i + BATCH_MAX)
    chunk.forEach(({ ref, field }) => {
      batch.update(ref, { [field]: arrayRemove(nodeId) })
    })
    await batch.commit()
  }
}
