import { addDoc, arrayRemove, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/firestore'
import { GRAPH_IDS, type NodeDoc } from '../model/types'
import { FIRESTORE_BATCH_LIMIT, nodeDocRef, nodesCollection, omitUndefinedFields } from './_paths'
import type { CreateTaskNodeData } from './nodes'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const PRIORITY_WINDOW_DAYS = 7

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/** Map the time-until-start into a 0..1 priority score, matching the heuristic
 *  used by calendar sync so manually-created tasks rank consistently. */
export function computeTaskPriority(startAtIso: string): number {
  const startAtMs = new Date(startAtIso).getTime()
  if (Number.isNaN(startAtMs)) return 0
  const deltaMs = startAtMs - Date.now()
  const windowMs = MS_PER_DAY * PRIORITY_WINDOW_DAYS
  return clamp(1 - deltaMs / windowMs, 0, 1)
}

/** Manual task creation. Lives in the tasks graph collection.
 *  Unlike context-graph nodes, tasks don't carry a canvas position. */
export async function createTaskNode(uid: string, data: CreateTaskNodeData): Promise<string> {
  const payload = omitUndefinedFields({ ...data })
  // Tasks never appear on the graph; we still set position so legacy readers
  // that expect the field don't crash, but we keep it at the origin.
  ;(payload as Record<string, unknown>).position = { x: 0, y: 0 }
  const docRef = await addDoc(nodesCollection(uid, GRAPH_IDS.tasks), payload)
  return docRef.id
}

/** Patch arbitrary task fields. Mirrors `upsertNode` but stays out of the
 *  CreateNodeData discriminated-union path for partial edits. */
export async function updateTaskFields(
  uid: string,
  taskId: string,
  fields: Partial<Pick<NodeDoc,
    'title' | 'name' | 'startAt' | 'endAt' | 'location' | 'priority' | 'linkedNodeIds'
  >>,
): Promise<void> {
  await setDoc(
    nodeDocRef(uid, GRAPH_IDS.tasks, taskId),
    omitUndefinedFields(fields),
    { merge: true },
  )
}

export type UpcomingTask = NodeDoc & {
  type: 'task'
  startAtMs: number
}

/** Tasks whose `endAt` (or `startAt`, if no end) is in the future, sorted by
 *  start time ascending. Non-task docs and unparseable timestamps are dropped. */
export async function getUpcomingTasks(uid: string): Promise<UpcomingTask[]> {
  const nowMs = Date.now()
  const snapshot = await getDocs(nodesCollection(uid, GRAPH_IDS.tasks))
  const upcoming: UpcomingTask[] = []
  snapshot.forEach((d) => {
    const data = { id: d.id, ...d.data() } as NodeDoc
    if (data.type !== 'task') return
    const startAtMs = typeof data.startAt === 'string' ? new Date(data.startAt).getTime() : NaN
    if (Number.isNaN(startAtMs)) return
    const endAtMs = typeof data.endAt === 'string' ? new Date(data.endAt).getTime() : NaN
    const referenceMs = Number.isNaN(endAtMs) ? startAtMs : endAtMs
    if (referenceMs < nowMs) return
    upcoming.push({ ...data, type: 'task', startAtMs })
  })
  upcoming.sort((a, b) => a.startAtMs - b.startAtMs)
  return upcoming
}

/** Sweep every task document and array-remove the given node id from its linkedNodeIds. */
export async function removeNodeIdFromAllTaskLinks(
  uid: string,
  deletedNodeId: string,
): Promise<void> {
  const snapshot = await getDocs(nodesCollection(uid, GRAPH_IDS.tasks))
  const affected: string[] = []
  snapshot.forEach((d) => {
    const data = d.data() as { type?: string; linkedNodeIds?: unknown }
    if (data.type !== 'task') return
    if (!Array.isArray(data.linkedNodeIds)) return
    if (!data.linkedNodeIds.includes(deletedNodeId)) return
    affected.push(d.id)
  })

  if (affected.length === 0) return

  for (let i = 0; i < affected.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db)
    affected.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((taskId) => {
      batch.set(
        nodeDocRef(uid, GRAPH_IDS.tasks, taskId),
        { linkedNodeIds: arrayRemove(deletedNodeId) },
        { merge: true },
      )
    })
    await batch.commit()
  }
}
