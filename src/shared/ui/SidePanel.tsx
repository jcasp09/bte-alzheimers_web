import { useEffect, type ReactNode } from 'react'
import clsx from 'clsx'
import styles from './SidePanel.module.css'

export type SidePanelAccent = 'person' | 'place' | 'memory' | 'connection' | 'neutral'

export type SidePanelHero = {
  avatarLabel?: string
  avatarImageUrl?: string
  avatarSlot?: ReactNode
}

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  accent?: SidePanelAccent
  hero?: SidePanelHero | null
  subtitle?: ReactNode
  titleSlot?: ReactNode
}

const accentClassByName: Record<SidePanelAccent, string> = {
  person: styles.accentPerson,
  place: styles.accentPlace,
  memory: styles.accentMemory,
  connection: styles.accentConnection,
  neutral: styles.accentNeutral,
}

export function SidePanel({
  title,
  onClose,
  children,
  accent = 'neutral',
  hero,
  subtitle,
  titleSlot,
}: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (hero) {
    const avatarContent = hero.avatarSlot
      ?? (hero.avatarImageUrl ? (
        <img src={hero.avatarImageUrl} alt="" className={styles.avatarImage} />
      ) : (
        hero.avatarLabel ?? ''
      ))

    return (
      <aside
        role="dialog"
        aria-labelledby="side-panel-title"
        className={clsx(styles.panel, styles.panelHero, accentClassByName[accent])}
      >
        <div className={styles.avatar} aria-hidden={hero.avatarSlot ? undefined : 'true'}>
          {avatarContent}
        </div>
        <div className={styles.panelRect}>
          <header className={styles.headerHero}>
            {titleSlot ? (
              <div id="side-panel-title" className={styles.titleHero}>
                {titleSlot}
              </div>
            ) : (
              <h2 id="side-panel-title" className={styles.titleHero}>
                {title}
              </h2>
            )}
            {subtitle ? (
              <p className={styles.subtitleHero}>{subtitle}</p>
            ) : null}
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
          {titleSlot ? (
            <div id="side-panel-title" className={styles.title}>
              {titleSlot}
            </div>
          ) : (
            <h2 id="side-panel-title" className={styles.title}>
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={styles.closeButton}
          >
            ✕
          </button>
        </header>
        {subtitle ? (
          <p className={styles.subtitle}>{subtitle}</p>
        ) : null}
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </aside>
  )
}
