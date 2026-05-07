import { useEffect, type ReactNode } from 'react'
import clsx from 'clsx'
import styles from './SidePanel.module.css'

export type SidePanelAccent = 'person' | 'place' | 'group' | 'moment' | 'connection' | 'neutral'

export type SidePanelHero = {
  avatarLabel?: string
}

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  accent?: SidePanelAccent
  hero?: SidePanelHero | null
}

const accentClassByName: Record<SidePanelAccent, string> = {
  person: styles.accentPerson,
  place: styles.accentPlace,
  group: styles.accentGroup,
  moment: styles.accentMoment,
  connection: styles.accentConnection,
  neutral: styles.accentNeutral,
}

export function SidePanel({ title, onClose, children, accent = 'neutral', hero }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (hero) {
    return (
      <aside
        role="dialog"
        aria-labelledby="side-panel-title"
        className={clsx(styles.panel, styles.panelHero, accentClassByName[accent])}
      >
        <div className={styles.avatar} aria-hidden="true">
          {hero.avatarLabel ?? ''}
        </div>
        <div className={styles.panelRect}>
          <header className={styles.headerHero}>
            <h2 id="side-panel-title" className={styles.titleHero}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={styles.closeButtonHero}
            >
              ✕
            </button>
          </header>
          <div className={styles.body}>
            {children}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      role="dialog"
      aria-labelledby="side-panel-title"
      className={clsx(styles.panel, styles.panelNoHero, accentClassByName[accent])}
    >
      <div className={styles.panelRect}>
        <header className={styles.header}>
          <h2 id="side-panel-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={styles.closeButton}
          >
            ✕
          </button>
        </header>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </aside>
  )
}
