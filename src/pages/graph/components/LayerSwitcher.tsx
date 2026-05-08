import clsx from 'clsx'
import type { Layer } from '../../../graph/model/flowConstants'
import styles from '../Graph.module.css'

type Props = {
  currentLayer: Layer
  onChange: (layer: Layer) => void
}

/** Top-of-canvas pill that toggles between the relationships and memories
 *  layers. The memories segment gets a small accent treatment. */
export function LayerSwitcher({ currentLayer, onChange }: Props) {
  return (
    <div className={styles.layerSwitcher} role="tablist" aria-label="Graph layer">
      <button
        type="button"
        role="tab"
        aria-selected={currentLayer === 'relationships'}
        className={clsx(
          styles.layerSwitcherSegment,
          currentLayer === 'relationships' && styles.layerSwitcherSegmentActive,
        )}
        onClick={() => onChange('relationships')}
      >
        Relationships
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={currentLayer === 'memories'}
        className={clsx(
          styles.layerSwitcherSegment,
          currentLayer === 'memories' && styles.layerSwitcherSegmentActive,
          currentLayer === 'memories' && styles.layerSwitcherSegmentMemories,
        )}
        onClick={() => onChange('memories')}
      >
        Memories
      </button>
    </div>
  )
}
