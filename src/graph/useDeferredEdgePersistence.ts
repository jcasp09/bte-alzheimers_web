import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { Connection, Edge } from '@xyflow/react'
import { createEdge, type GraphId } from '../firebase/graph'

export type PendingEdgeRow = {
  localId: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

type SetEdges = Dispatch<SetStateAction<Edge[]>>

/**
 * Queue new edges in local React state and flush to Firestore when the tab is hidden,
 * the page is unloaded, or the host component unmounts (e.g. SPA navigation away).
 */
export function useDeferredEdgePersistence(
  uid: string | undefined,
  graphId: GraphId,
  setEdges: SetEdges,
  setSyncError: (message: string | null) => void,
) {
  const pendingRef = useRef<PendingEdgeRow[]>([])
  const flushRef = useRef<() => Promise<void>>(async () => {})

  const flushPendingEdges = useCallback(async () => {
    if (!uid) return
    const queue = [...pendingRef.current]
    if (queue.length === 0) return
    pendingRef.current = []
    const failed: PendingEdgeRow[] = []
    for (const row of queue) {
      try {
        const serverId = await createEdge(uid, row.source, row.target, graphId, {
          sourceHandle: row.sourceHandle,
          targetHandle: row.targetHandle,
        })
        setEdges((eds) => eds.map((e) => (e.id === row.localId ? { ...e, id: serverId } : e)))
      } catch {
        failed.push(row)
      }
    }
    pendingRef.current.push(...failed)
    if (failed.length > 0) {
      setSyncError(`Some connections could not be saved (${failed.length}). Try again or refresh.`)
    } else {
      setSyncError(null)
    }
  }, [uid, graphId, setEdges, setSyncError])

  flushRef.current = flushPendingEdges

  const queueConnection = useCallback(
    (connection: Connection) => {
      const src = connection.source
      const tgt = connection.target
      if (!src || !tgt || src === tgt) return
      const localId = `local-${crypto.randomUUID()}`
      const sourceHandle = connection.sourceHandle ?? undefined
      const targetHandle = connection.targetHandle ?? undefined
      setEdges((eds) => [
        ...eds,
        {
          id: localId,
          source: src,
          target: tgt,
          sourceHandle,
          targetHandle,
          type: 'default',
        },
      ])
      pendingRef.current.push({
        localId,
        source: src,
        target: tgt,
        sourceHandle,
        targetHandle,
      })
    },
    [setEdges],
  )

  const queueConnectionFromModal = useCallback(
    (sourceId: string, targetId: string, sourceHandle: string, targetHandle: string) => {
      const localId = `local-${crypto.randomUUID()}`
      setEdges((eds) => [
        ...eds,
        {
          id: localId,
          source: sourceId,
          target: targetId,
          sourceHandle,
          targetHandle,
          type: 'default',
        },
      ])
      pendingRef.current.push({
        localId,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
      })
    },
    [setEdges],
  )

  const removePendingEdge = useCallback(
    (localId: string) => {
      pendingRef.current = pendingRef.current.filter((r) => r.localId !== localId)
      setEdges((eds) => eds.filter((e) => e.id !== localId))
    },
    [setEdges],
  )

  useEffect(() => {
    if (!uid) return
    const run = () => {
      void flushRef.current()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        run()
      }
    }
    window.addEventListener('pagehide', run)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', run)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [uid])

  useEffect(() => {
    return () => {
      void flushRef.current()
    }
  }, [uid])

  const onBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (pendingRef.current.length > 0) {
      e.preventDefault()
      e.returnValue = ''
    }
  }, [])

  useEffect(() => {
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [onBeforeUnload])

  return {
    queueConnection,
    queueConnectionFromModal,
    flushPendingEdges,
    removePendingEdge,
  }
}

export function isLocalPendingEdgeId(edgeId: string): boolean {
  return edgeId.startsWith('local-')
}
