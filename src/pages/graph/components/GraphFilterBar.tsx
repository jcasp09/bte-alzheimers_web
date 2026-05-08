import clsx from 'clsx'
import type { Layer } from '../../../graph/model/flowConstants'
import type { VisibleTypes } from '../lib/nodeMappers'
import styles from '../Graph.module.css'

type Props = {
  expanded: boolean
  setExpanded: (next: boolean) => void
  currentLayer: Layer
  visibleTypes: VisibleTypes
  setVisibleTypes: (updater: (prev: VisibleTypes) => VisibleTypes) => void
}

/** Collapsible row of toggle chips for People / Places / Groups.
 *  The Groups chip only appears on the relationships layer. */
export function GraphFilterBar({ expanded, setExpanded, currentLayer, visibleTypes, setVisibleTypes }: Props) {
  return (
    <>
      <div
        className={clsx(styles.filterRow, expanded && styles.filterRowExpanded)}
        role="group"
        aria-label="Toggle node types"
        aria-hidden={!expanded}
      >
        <button
          type="button"
          onClick={() => setVisibleTypes((v) => ({ ...v, person: !v.person }))}
          aria-pressed={visibleTypes.person}
          className={clsx(styles.filterChip, visibleTypes.person && styles.filterChipActive, visibleTypes.person && styles.filterChipPerson)}
        >
          <span className={styles.filterChipDot} style={{ backgroundColor: 'var(--color-node-person-border)' }} aria-hidden="true" />
          People
        </button>
        <button
          type="button"
          onClick={() => setVisibleTypes((v) => ({ ...v, place: !v.place }))}
          aria-pressed={visibleTypes.place}
          className={clsx(styles.filterChip, visibleTypes.place && styles.filterChipActive, visibleTypes.place && styles.filterChipPlace)}
        >
          <span className={styles.filterChipDot} style={{ backgroundColor: 'var(--color-node-place-border)' }} aria-hidden="true" />
          Places
        </button>
        {currentLayer === 'relationships' ? (
          <button
            type="button"
            onClick={() => setVisibleTypes((v) => ({ ...v, group: !v.group }))}
            aria-pressed={visibleTypes.group}
            className={clsx(styles.filterChip, visibleTypes.group && styles.filterChipActive, visibleTypes.group && styles.filterChipGroup)}
          >
            <span className={styles.filterChipDot} style={{ backgroundColor: 'var(--color-border-strong)' }} aria-hidden="true" />
            Groups
          </button>
        ) : null}
        <button
          type="button"
          className={styles.chromeCloseButton}
          onClick={() => setExpanded(false)}
          aria-label="Hide filters"
          tabIndex={expanded ? 0 : -1}
        >
          ✕
        </button>
      </div>
      <button
        type="button"
        className={clsx(styles.fab, styles.fabFilter, expanded && styles.fabHidden)}
        onClick={() => setExpanded(true)}
        aria-label="Show node-type filters"
        aria-hidden={expanded}
        tabIndex={expanded ? -1 : 0}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <line x1="3" y1="5" x2="15" y2="5" />
          <line x1="5" y1="9" x2="13" y2="9" />
          <line x1="7" y1="13" x2="11" y2="13" />
        </svg>
      </button>
    </>
  )
}
