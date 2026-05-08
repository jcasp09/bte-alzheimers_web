import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node, Viewport } from '@xyflow/react'
import {
  GRAPH_IDS,
  getEdges,
  getGraphViewport,
  getNodes,
} from '../../../graph/data/graph'
import { getMemories, type MemoryDoc } from '../../../memories/data/memories'
import {
  firestoreEdgesToReactFlow,
  firestoreNodesToReactFlow,
} from '../lib/nodeMappers'

/** Loads context-graph nodes/edges/viewport plus memories for the active user.
 *  Owns the canonical state for these collections; consumers read and mutate
 *  them through the returned setters and the imperative reload helper. */
export function useGraphData(uid: string | undefined) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [memories, setMemories] = useState<MemoryDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialViewport, setInitialViewport] = useState<Viewport | undefined>(undefined)
  const flowKeyRef = useRef(0)
  const [flowKey, setFlowKey] = useState(0)

  /** Fetch everything in parallel and force-remount the flow so React Flow
   *  picks up the new initial viewport. Pass skipLoading when refreshing
   *  in-place after a successful mutation. */
  const loadGraph = useCallback(async (opts?: { skipLoading?: boolean }) => {
    if (!uid) return
    if (!opts?.skipLoading) setLoading(true)
    setError(null)
    try {
      const [nodesData, edgesData, viewport, memoriesData] = await Promise.all([
        getNodes(uid, GRAPH_IDS.context),
        getEdges(uid, GRAPH_IDS.context),
        getGraphViewport(uid, GRAPH_IDS.context),
        getMemories(uid),
      ])
      setNodes(firestoreNodesToReactFlow(nodesData))
      setEdges(firestoreEdgesToReactFlow(edgesData))
      setMemories(memoriesData)
      setInitialViewport(viewport ?? undefined)
      flowKeyRef.current += 1
      setFlowKey(flowKeyRef.current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph')
    } finally {
      if (!opts?.skipLoading) setLoading(false)
    }
  }, [uid])

  // Initial load + reload when the active user changes. Logged-out state clears
  // the in-memory collections so a stale graph never leaks across users.
  useEffect(() => {
    if (!uid) {
      setLoading(false)
      setNodes([])
      setEdges([])
      setMemories([])
      return
    }
    void loadGraph()
  }, [uid, loadGraph])

  return {
    nodes, setNodes,
    edges, setEdges,
    memories, setMemories,
    initialViewport,
    flowKey,
    loading,
    error,
    loadGraph,
  }
}
