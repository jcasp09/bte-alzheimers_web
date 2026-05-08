import { type DragEvent as ReactDragEvent } from 'react'
import clsx from 'clsx'
import {
  DOCK_NODE_DND_TYPE,
} from '../../../graph/model/flowConstants'
import type { AddGroupPlacement } from '../hooks/useGroupPlacement'
import styles from '../Graph.module.css'

type DockKind = 'person' | 'place' | 'group' | 'memory'

type Props = {
  openPanel: 'addPerson' | 'addPlace' | 'addConnection' | 'addMemory' | null
  togglePerson: () => void
  togglePlace: () => void
  toggleConnection: () => void
  groupPlacement: AddGroupPlacement
  toggleGroupPlacement: () => void
}

function dockDragStart(kind: DockKind) {
  return (e: ReactDragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DOCK_NODE_DND_TYPE, kind)
    e.dataTransfer.effectAllowed = 'copy'
  }
}

/** Bottom-of-canvas dock with the four node-creation actions. */
export function GraphDock({
  openPanel,
  togglePerson,
  togglePlace,
  toggleConnection,
  groupPlacement,
  toggleGroupPlacement,
}: Props) {
  const groupActive = groupPlacement.status === 'picking'
  return (
    <div className={styles.dock} role="toolbar" aria-label="Graph actions">
      <button
        type="button"
        draggable
        onDragStart={dockDragStart('person')}
        onClick={togglePerson}
        aria-label="Add a person. Click to place at default position, or drag onto the canvas to choose a spot."
        className={clsx(styles.dockItem, styles.dockItemDraggable, openPanel === 'addPerson' && styles.dockItemActive)}
      >
        <span className={clsx(styles.dockIcon, styles.dockIconPerson)} aria-hidden="true">+</span>
        <span className={styles.dockLabel}>Person</span>
      </button>

      <button
        type="button"
        draggable
        onDragStart={dockDragStart('place')}
        onClick={togglePlace}
        aria-label="Add a place. Click to place at default position, or drag onto the canvas to choose a spot."
        className={clsx(styles.dockItem, styles.dockItemDraggable, openPanel === 'addPlace' && styles.dockItemActive)}
      >
        <span className={clsx(styles.dockIcon, styles.dockIconPlace)} aria-hidden="true">+</span>
        <span className={styles.dockLabel}>Place</span>
      </button>

      <button
        type="button"
        draggable
        onDragStart={dockDragStart('group')}
        onClick={toggleGroupPlacement}
        aria-label={groupActive ? 'Cancel group placement' : 'Add a group. Click to draw a region, or drag onto the canvas to drop a default-sized group.'}
        className={clsx(styles.dockItem, styles.dockItemDraggable, groupActive && styles.dockItemActive)}
      >
        <span className={clsx(styles.dockIcon, styles.dockIconGroup)} aria-hidden="true">+</span>
        <span className={styles.dockLabel}>Group</span>
      </button>

      <span className={styles.dockDivider} aria-hidden="true" />

      <button
        type="button"
        onClick={toggleConnection}
        aria-label="Link two nodes"
        className={clsx(styles.dockItem, openPanel === 'addConnection' && styles.dockItemActive)}
      >
        <span className={clsx(styles.dockIcon, styles.dockIconLink)} aria-hidden="true">↔</span>
        <span className={styles.dockLabel}>Link</span>
      </button>
    </div>
  )
}
