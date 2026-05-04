import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { type Theme, getTheme, setTheme, subscribeToThemeChange } from '../services/theme'
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

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Theme</h2>
      <p className={styles.sectionSubtitle}>
        Choose a color palette. Your selection is saved to your account and follows you across devices.
      </p>

      <ul className={styles.optionList} role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map((option) => {
          const isActive = current === option.value
          return (
            <li key={option.value}>
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setTheme(option.value)}
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
  )
}

export default Appearance
