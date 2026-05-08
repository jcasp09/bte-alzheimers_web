import type { AddGroupPlacement } from '../hooks/useGroupPlacement'
import styles from '../Graph.module.css'

type Props = { placement: AddGroupPlacement }

/** Floating instruction copy shown while the user is two-click drawing a
 *  group region on the canvas. Returns null when not in placement mode. */
export function GroupPlacementHint({ placement }: Props) {
  if (placement.status !== 'picking') return null
  return (
    <p className={styles.hintFloat}>
      {placement.phase === 1
        ? 'Click the top-left corner of the new group on the graph, then the bottom-right. Pan with middle or right mouse drag, or the scroll wheel. Press Esc to cancel.'
        : 'Now click the bottom-right corner. Esc to cancel.'}
    </p>
  )
}
