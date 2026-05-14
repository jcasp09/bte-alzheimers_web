import clsx from 'clsx'
import { RINGS, type RingTier } from '../model/rings'
import styles from './RingPicker.module.css'

type Props = {
  value: RingTier | null
  predicted: RingTier | null
  onChange: (next: RingTier) => void
  showAutoIndicator?: boolean
  disabled?: boolean
  label?: string
  scope?: 'people' | 'places'
}

export function RingPicker({
  value,
  predicted,
  onChange,
  showAutoIndicator,
  disabled,
  label = 'Ring',
  scope,
}: Props) {
  const visibleRings = scope ? RINGS.filter((r) => r.scope === scope) : RINGS
  const active = value ?? predicted
  const usingPrediction = value == null
  return (
    <div className={styles.wrap}>
      <p className={styles.label}>{label}</p>
      <div className={styles.choices} role="radiogroup" aria-label={label}>
        {visibleRings.map((ring) => {
          const isActive = active === ring.tier
          const marked = isActive && usingPrediction && !!showAutoIndicator
          return (
            <button
              key={ring.tier}
              type="button"
              className={clsx(
                styles.choice,
                styles[`choiceTier${ring.tier}`],
                isActive && styles.choiceActive,
                marked && styles.choiceAutoSuggested,
              )}
              onClick={() => onChange(ring.tier)}
              aria-pressed={isActive}
              disabled={disabled}
              title={
                isActive && marked
                  ? `${ring.hint} (suggested — click any ring to confirm or change)`
                  : ring.hint
              }
            >
              {ring.label}
              {marked ? (
                <span
                  className={styles.autoMark}
                  aria-label="Auto-suggested"
                  aria-hidden={false}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
