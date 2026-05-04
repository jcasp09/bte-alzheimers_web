import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import styles from './Settings.module.css'

const TABS: { to: string; label: string }[] = [
  { to: 'account', label: 'Account' },
  { to: 'appearance', label: 'Appearance' },
  { to: 'accessibility', label: 'Accessibility' },
]

function Settings() {
  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Account settings</h1>
        <p className={styles.subtitle}>Manage your account and how the app looks.</p>
      </header>

      <nav className={styles.tabs} aria-label="Settings sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) => clsx(styles.tab, isActive && styles.tabActive)}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.panel}>
        <Outlet />
      </div>
    </section>
  )
}

export default Settings
