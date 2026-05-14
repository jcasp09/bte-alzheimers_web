import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node, Viewport } from '@xyflow/react'
import { getEdges } from '../../../graph/data/edges'
import { getNodes, removePassedTaskNodes } from '../../../graph/data/nodes'
import { ensureSelfNode } from '../../../graph/data/selfNode'
import { getGraphViewport } from '../../../graph/data/viewport'
import { getUpcomingTasks, type UpcomingTask } from '../../../graph/data/tasks'
import { GRAPH_IDS, SELF_NODE_ID } from '../../../graph/model/types'
import { getMemories, type MemoryDoc } from '../../../memories/data/memories'
import {
  firestoreEdgesToReactFlow,
  firestoreNodesToReactFlow,
} from '../lib/nodeMappers'

/** Loads context-graph nodes/edges/viewport plus memories and upcoming tasks
 *  for the active user. Owns the canonical state for these collections;
 *  consumers read and mutate them through the returned setters and the
 *  imperative reload helpers. */
export function useGraphData(uid: string | undefined) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [memories, setMemories] = useState<MemoryDoc[]>([])
  const [tasks, setTasks] = useState<UpcomingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialViewport, setInitialViewport] = useState<Viewport | undefined>(undefined)
  const flowKeyRef = useRef(0)
  const [flowKey, setFlowKey] = useState(0)

  const reloadTasks = useCallback(async () => {
    if (!uid) return
    try {
      const upcoming = await getUpcomingTasks(uid)
      setTasks(upcoming)
    } catch (err) {
      console.warn('Failed to refresh upcoming tasks', err)
    }
  }, [uid])

  /** Fetch everything in parallel and force-remount the flow so React Flow
   *  picks up the new initial viewport. Pass skipLoading when refreshing
   *  in-place after a successful mutation. */
  const loadGraph = useCallback(async (opts?: { skipLoading?: boolean }) => {
    if (!uid) return
    if (!opts?.skipLoading) setLoading(true)
    setError(null)
    try {
      try {
        await removePassedTaskNodes(uid)
      } catch (sweepErr) {
        console.warn('Failed to remove passed task nodes', sweepErr)
      }

      const [nodesData, edgesData, viewport, memoriesData, tasksData] = await Promise.all([
        getNodes(uid, GRAPH_IDS.context),
        getEdges(uid, GRAPH_IDS.context),
        getGraphViewport(uid, GRAPH_IDS.context),
        getMemories(uid),
        getUpcomingTasks(uid),
      ])

      let mergedNodes = nodesData
      const hasSelf = nodesData.some((n) => n.id === SELF_NODE_ID || n.type === 'self')
      if (!hasSelf) {
        const selfDoc = await ensureSelfNode(uid, GRAPH_IDS.context)
        mergedNodes = [selfDoc, ...nodesData]
      }

      setNodes(firestoreNodesToReactFlow(mergedNodes))
      setEdges(firestoreEdgesToReactFlow(edgesData))
      setMemories(memoriesData)
      setTasks(tasksData)
      setInitialViewport(viewport ?? undefined)
      flowKeyRef.current += 1
      setFlowKey(flowKeyRef.current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph')
    } finally {
      if (!opts?.skipLoading) setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      setNodes([])
      setEdges([])
      setMemories([])
      setTasks([])
      return
    }
    void loadGraph()
  }, [uid, loadGraph])

  return {
    nodes, setNodes,
    edges, setEdges,
    memories, setMemories,
    tasks, setTasks,
    initialViewport,
    flowKey,
    loading,
    error,
    loadGraph,
    reloadTasks,
  }
}
