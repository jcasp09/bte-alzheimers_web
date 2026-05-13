/** Persistence for the saved React Flow viewport (pan + zoom) per graph. */
import { getDoc, setDoc } from 'firebase/firestore'
import { GRAPH_IDS, type GraphId, type GraphViewport } from '../model/types'
import { viewportDocRef } from './_paths'

/** Reject NaN/Infinity/non-finite components. A previously buggy render path
 *  would write garbage here and brick the next load. */
function isValidViewport(v: unknown): v is GraphViewport {
  if (v == null || typeof v !== 'object') return false
  const { x, y, zoom } = v as Partial<GraphViewport>
  return (
    typeof x === 'number' && Number.isFinite(x) &&
    typeof y === 'number' && Number.isFinite(y) &&
    typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0
  )
}

export async function saveGraphViewport(
  uid: string,
  viewport: GraphViewport,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
  if (!isValidViewport(viewport)) return
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
  const v = data.viewport
  return isValidViewport(v) ? v : null
}
