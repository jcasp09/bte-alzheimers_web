import clsx from 'clsx'
import styles from '../Graph.module.css'

type Props = {
  expanded: boolean
  setExpanded: (next: boolean) => void
}

/** Floating button that shows/hides the React Flow minimap. Renders a close
 *  button when expanded (the minimap itself is owned by DefaultFlow). */
export function MinimapToggle({ expanded, setExpanded }: Props) {
  if (expanded) {
    return (
      <button
        type="button"
        className={styles.minimapClose}
        onClick={() => setExpanded(false)}
        aria-label="Hide minimap"
      >
        ✕
      </button>
    )
  }
  return (
    <button
      type="button"
      className={clsx(styles.fab, styles.fabMinimap)}
      onClick={() => setExpanded(true)}
      aria-label="Show minimap"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
        <rect x="6" y="6.5" width="6" height="4" rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="none" />
      </svg>
    </button>
  )
}
