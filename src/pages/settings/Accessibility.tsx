import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  MOTION_MODES,
  type MotionMode,
  getMotionMode,
  setMotionMode,
  subscribeToMotionChange,
} from '../../services/motion'
import { useRadioGroupKeyboard } from '../../shared/hooks/useRadioGroupKeyboard'
import PageHeader from '../../shared/ui/PageHeader'
import styles from './Accessibility.module.css'

type MotionOption = {
  value: MotionMode
  label: string
  description: string
}

const MOTION_OPTIONS: MotionOption[] = [
  {
    value: 'system',
    label: 'Follow system',
    description: 'Use your device’s reduced-motion setting. Recommended.',
  },
  {
    value: 'reduce',
    label: 'Always reduce',
    description: 'Minimize movement and animation regardless of system setting.',
  },
]

function Accessibility() {
  const [current, setCurrent] = useState<MotionMode>(() => getMotionMode())

  useEffect(() => subscribeToMotionChange(setCurrent), [])

  const { optionRefs, handleKeyDown } = useRadioGroupKeyboard({
    count: MOTION_OPTIONS.length,
    onSelect: (index) => setMotionMode(MOTION_OPTIONS[index].value),
  })

  return (
    <div>
      <PageHeader
        title="Accessibility"
        subtitle="Adjust motion and other accessibility preferences to suit you."
      />

      <div className="card">
        <h3 className="card-title">Motion</h3>
        <p className="card-subtitle">
          Animation can be disorienting for some people.
          This controls whether the app reduces motion, such as the gentle floating of graph nodes.
        </p>

        <ul className={styles.optionList} role="radiogroup" aria-label="Motion preference">
          {MOTION_OPTIONS.map((option, index) => {
            const isActive = current === option.value
            void (option.value satisfies (typeof MOTION_MODES)[number])
            return (
              <li key={option.value}>
                <button
                  ref={(el) => { optionRefs.current[index] = el }}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setMotionMode(option.value)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={clsx(styles.option, isActive && styles.optionActive)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  <span className={styles.optionDescription}>{option.description}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default Accessibility
