import styles from './SettingsPageHeader.module.css'

type SettingsPageHeaderProps = {
  title: string
  subtitle?: string
}

function SettingsPageHeader({ title, subtitle }: SettingsPageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <h2 className={styles.pageTitle}>{title}</h2>
      {subtitle != null && <p className={styles.pageSubtitle}>{subtitle}</p>}
    </header>
  )
}

export default SettingsPageHeader
