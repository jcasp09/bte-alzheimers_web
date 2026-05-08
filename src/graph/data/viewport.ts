/** Persistence for the saved React Flow viewport (pan + zoom) per graph. */
import { getDoc, setDoc } from 'firebase/firestore'
import { GRAPH_IDS, type GraphId, type GraphViewport } from '../model/types'
import { viewportDocRef } from './_paths'

export async function saveGraphViewport(
  uid: string,
  viewport: GraphViewport,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<void> {
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
  return data.viewport ?? null
}
