import {
  arrayRemove,
  collection,
  deleteDoc,
  documentId,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { db } from './firestore'
import { storage } from './storage'

export const MAX_PEOPLE_PER_MEMORY = 10
export const MAX_PLACES_PER_MEMORY = 4
export const MAX_PHOTOS_PER_MEMORY = 10

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

export type MemoryDoc = {
  id: string
  title: string
  description: string
  occurredOn: string
  personNodeIds: string[]
  placeNodeIds: string[]
  /** Storage object paths under `users/{uid}/memories/{memoryId}/…` */
  photoPaths: string[]
  createdAt: Timestamp | null
}

export type CreateMemoryInput = {
  title: string
  description: string
  occurredOn: string
  personNodeIds: string[]
  placeNodeIds: string[]
}

export type UpdateMemoryInput = Partial<{
  title: string
  description: string
  occurredOn: string
  personNodeIds: string[]
  placeNodeIds: string[]
  photoPaths: string[]
}>

function memoriesCollection(uid: string) {
  return collection(db, 'users', uid, 'memories')
}

function memoryDateLockRef(uid: string, occurredOn: string) {
  return doc(db, 'users', uid, 'memoryDateLocks', occurredOn)
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
    .slice(0, MAX_PHOTOS_PER_MEMORY)
}

function validateMemoryPhotoPaths(uid: string, memoryId: string, paths: string[]): void {
  const prefix = `users/${uid}/memories/${memoryId}/`
  for (const p of paths) {
    if (!p.startsWith(prefix)) {
      throw new Error('Invalid photo path for this memory.')
    }
  }
}

/** Richness score for layout at day/memory level (not used for year/month buckets). */
export function memoryRichnessScore(m: Pick<MemoryDoc, 'title' | 'description' | 'personNodeIds' | 'placeNodeIds' | 'photoPaths'>): number {
  const people = m.personNodeIds?.length ?? 0
  const places = m.placeNodeIds?.length ?? 0
  const photos = m.photoPaths?.length ?? 0
  const descLen = (m.description ?? '').trim().length
  const descTerm = Math.min(descLen / 200, 1) * 2
  const titleBonus = (m.title ?? '').trim().length > 0 ? 0.5 : 0
  return people + places + photos * 1.5 + descTerm + titleBonus
}

export async function getMemories(uid: string): Promise<MemoryDoc[]> {
  const snapshot = await getDocs(memoriesCollection(uid))
  return snapshot.docs.map((d) => {
    const data = d.data() as Omit<MemoryDoc, 'id' | 'createdAt'> & { createdAt?: Timestamp }
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

export async function createMemory(uid: string, input: CreateMemoryInput): Promise<string> {
  if (!parseOccurredOn(input.occurredOn)) {
    throw new Error('Choose a valid date.')
  }
  const personNodeIds = [...new Set(input.personNodeIds)].slice(0, MAX_PEOPLE_PER_MEMORY)
  const placeNodeIds = [...new Set(input.placeNodeIds)].slice(0, MAX_PLACES_PER_MEMORY)
  await Promise.all([
    validateContextNodeIdsByType(uid, personNodeIds, 'person'),
    validateContextNodeIdsByType(uid, placeNodeIds, 'place'),
  ])

  const newMemoryRef = doc(memoriesCollection(uid))
  const lockRef = memoryDateLockRef(uid, input.occurredOn)

  await runTransaction(db, async (tx) => {
    const lockSnap = await tx.get(lockRef)
    if (lockSnap.exists()) {
      throw new Error('You already have a memory on this date. Only one memory per day is allowed.')
    }
    tx.set(newMemoryRef, {
      title: input.title,
      description: input.description,
      occurredOn: input.occurredOn,
      personNodeIds,
      placeNodeIds,
      photoPaths: [],
      createdAt: serverTimestamp(),
    })
    tx.set(lockRef, { memoryId: newMemoryRef.id })
  })
  return newMemoryRef.id
}

export async function updateMemory(
  uid: string,
  memoryId: string,
  patch: UpdateMemoryInput,
): Promise<void> {
  const memoryRef = doc(db, 'users', uid, 'memories', memoryId)

  if (patch.occurredOn !== undefined) {
    if (!parseOccurredOn(patch.occurredOn)) {
      throw new Error('Use a valid calendar date (YYYY-MM-DD).')
    }
    const newOccurredOn = patch.occurredOn
    const newLockRef = memoryDateLockRef(uid, newOccurredOn)

    await runTransaction(db, async (tx) => {
      const memorySnap = await tx.get(memoryRef)
      if (!memorySnap.exists())
        throw new Error('Memory not found.')

      const currentOccurredOn = (memorySnap.data() as { occurredOn?: string }).occurredOn ?? ''
      if (currentOccurredOn === newOccurredOn)
        return

      const newLockSnap = await tx.get(newLockRef)
      if (newLockSnap.exists() && newLockSnap.data().memoryId !== memoryId)

      if (currentOccurredOn) {
        tx.delete(memoryDateLockRef(uid, currentOccurredOn))
      }
      tx.set(newLockRef, { memoryId })
      tx.update(memoryRef, { occurredOn: newOccurredOn })
    })
  }

  const payload: Record<string, unknown> = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.personNodeIds !== undefined) {
    const personNodeIds = [...new Set(patch.personNodeIds)].slice(0, MAX_PEOPLE_PER_MEMORY)
    await validateContextNodeIdsByType(uid, personNodeIds, 'person')
    payload.personNodeIds = personNodeIds
  }
  if (patch.placeNodeIds !== undefined) {
    const placeNodeIds = [...new Set(patch.placeNodeIds)].slice(0, MAX_PLACES_PER_MEMORY)
    await validateContextNodeIdsByType(uid, placeNodeIds, 'place')
    payload.placeNodeIds = placeNodeIds
  }
  if (patch.photoPaths !== undefined) {
    const photoPaths = normalizePhotoPaths(patch.photoPaths)
    validateMemoryPhotoPaths(uid, memoryId, photoPaths)
    payload.photoPaths = photoPaths
  }
  if (Object.keys(payload).length === 0) return
  await updateDoc(memoryRef, payload)
}

export async function deleteMemory(uid: string, memoryId: string): Promise<void> {
  const refDoc = doc(db, 'users', uid, 'memories', memoryId)
  const snap = await getDoc(refDoc)
  if (!snap.exists()) return
  const data = snap.data() as { photoPaths?: unknown; occurredOn?: string }
  const paths = normalizePhotoPaths(data.photoPaths)
  const occurredOn = typeof data.occurredOn === 'string' ? data.occurredOn : ''
  await Promise.all(
    paths.map((p) =>
      deleteObject(ref(storage, p)).catch(() => {
        /* object may already be gone */
      }),
    ),
  )
  await deleteDoc(refDoc)
  if (occurredOn) {
    await deleteDoc(memoryDateLockRef(uid, occurredOn))
  }
}

/** After a person or place graph node is removed, strip its id from all memories. */
export async function removeMemoryReferencesToDeletedNode(uid: string, nodeId: string): Promise<void> {
  const col = memoriesCollection(uid)
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
