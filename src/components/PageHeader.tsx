import styles from './PageHeader.module.css'

type PageHeaderProps = {
  title: string
  subtitle?: string
}

/** Page-level title block. Used at the top of sub-pages within a section. */
function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <h2 className={styles.pageTitle}>{title}</h2>
      {subtitle != null && <p className={styles.pageSubtitle}>{subtitle}</p>}
    </header>
  )
}

export default PageHeader
