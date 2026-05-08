import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { type Theme, getTheme, setTheme, subscribeToThemeChange } from '../../settings/theme'
import { useRadioGroupKeyboard } from '../../shared/hooks/useRadioGroupKeyboard'
import PageHeader from '../../shared/ui/PageHeader'
import styles from './Appearance.module.css'

type ThemeOption = {
  value: Theme
  label: string
  description: string
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'soft', label: 'Soft', description: 'Calm sage greens. The default look.' },
  { value: 'warm', label: 'Warm', description: 'Parchment and brown for a softer, paper-like feel.' },
  { value: 'dark', label: 'Dark', description: 'Low-light navy with warm gold accents. Easier in dim rooms.' },
]

/**
 * A miniature mock of the app shell rendered with a specific theme's tokens.
 */
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div data-theme={theme} className={styles.preview} aria-hidden="true">
      <div className={styles.previewHeader}>
        <span className={styles.previewBrandDot} />
        <span className={styles.previewBrandLine} />
        <span className={styles.previewAvatar} />
      </div>
      <div className={styles.previewCard}>
        <span className={styles.previewTitle} />
        <span className={styles.previewText} />
        <span className={clsx(styles.previewText, styles.previewTextShort)} />
        <span className={styles.previewButton}>Open</span>
      </div>
    </div>
  )
}

function Appearance() {
  const [current, setCurrent] = useState<Theme>(() => getTheme())

  // Stay in sync if the theme changes elsewhere.
  useEffect(() => subscribeToThemeChange(setCurrent), [])

  const { optionRefs, handleKeyDown } = useRadioGroupKeyboard({
    count: THEME_OPTIONS.length,
    onSelect: (index) => setTheme(THEME_OPTIONS[index].value),
  })

  return (
    <div>
      <PageHeader
        title="Appearance"
        subtitle="Choose how the app looks. Changes apply immediately."
      />

      <div className="card">
        <h3 className="card-title">Theme</h3>
        <p className="card-subtitle">
          Choose a color palette. Your selection is saved to your account and follows you across devices.
        </p>

        <ul className={styles.optionList} role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option, index) => {
            const isActive = current === option.value
            return (
              <li key={option.value}>
                <button
                  ref={(el) => { optionRefs.current[index] = el }}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setTheme(option.value)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={clsx(styles.option, isActive && styles.optionActive)}
                >
                  <ThemePreview theme={option.value} />
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

export default Appearance
