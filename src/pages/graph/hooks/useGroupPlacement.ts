import { useCallback, useEffect, useRef, useState } from 'react'
import type { XY } from '../../../graph/model/flowConstants'
import { rectFromCorners } from '../lib/nodeMappers'

export type AddGroupPlacement =
  | { status: 'idle' }
  | { status: 'picking'; phase: 1 }
  | { status: 'picking'; phase: 2; p1: XY }

export type PendingGroupRect = { x: number; y: number; width: number; height: number }

/** Two-click "draw a group region" state machine plus the resulting pending
 *  rect. Holds an internal ref shadow of the current placement so that the
 *  pane-click handler can read the latest status synchronously without
 *  recreating its identity each render. */
export function useGroupPlacement() {
  const [addGroupPlacement, setAddGroupPlacementState] = useState<AddGroupPlacement>({ status: 'idle' })
  const [pendingGroupRect, setPendingGroupRect] = useState<PendingGroupRect | null>(null)
  const addGroupPlacementRef = useRef<AddGroupPlacement>({ status: 'idle' })

  /** Update both the React state and the ref shadow in lockstep. */
  const setAddGroupPlacement = useCallback((next: AddGroupPlacement) => {
    addGroupPlacementRef.current = next
    setAddGroupPlacementState(next)
  }, [])

  // Defensive sync in case external code mutates the state directly.
  useEffect(() => {
    addGroupPlacementRef.current = addGroupPlacement
  }, [addGroupPlacement])

  /** Pane click during placement: phase-1 records the first corner, phase-2
   *  finalizes the rect and exits placement. */
  const handlePaneFlowClick = useCallback((point: XY) => {
    const cur = addGroupPlacementRef.current
    if (cur.status !== 'picking') return
    if (cur.phase === 1) {
      setAddGroupPlacement({ status: 'picking', phase: 2, p1: point })
      return
    }
    setPendingGroupRect(rectFromCorners(cur.p1, point))
    setAddGroupPlacement({ status: 'idle' })
  }, [setAddGroupPlacement])

  // Escape cancels placement first; if no placement, clears any pending rect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (addGroupPlacementRef.current.status === 'picking') {
        setAddGroupPlacement({ status: 'idle' })
        return
      }
      if (pendingGroupRect) setPendingGroupRect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingGroupRect, setAddGroupPlacement])

  return {
    addGroupPlacement,
    addGroupPlacementRef,
    setAddGroupPlacement,
    pendingGroupRect,
    setPendingGroupRect,
    handlePaneFlowClick,
  }
}
