import { getDoc, setDoc } from 'firebase/firestore'
import { nodeDocRef } from './_paths'
import { GRAPH_IDS, SELF_NODE_ID, type GraphId, type NodeDoc } from '../model/types'

export async function ensureSelfNode(
  uid: string,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<NodeDoc> {
  const ref = nodeDocRef(uid, graphId, SELF_NODE_ID)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    return { id: SELF_NODE_ID, ...(snap.data() as Omit<NodeDoc, 'id'>) }
  }

  const fresh: Omit<NodeDoc, 'id'> = {
    type: 'self',
    name: '',
    position: { x: 0, y: 0 },
  }
  await setDoc(ref, fresh)
  return { id: SELF_NODE_ID, ...fresh }
}
