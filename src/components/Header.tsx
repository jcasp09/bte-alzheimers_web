import { NavLink, Link } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import styles from './Header.module.css'

const PRODUCT_NAME = 'Memory Jog'

function displayLabelFor(user: { displayName?: string | null; email?: string | null } | null): string {
  if (user == null)
    return 'Sign in'

  if (user.displayName != null && user.displayName.trim() !== '')
    return user.displayName

  if (user.email != null && user.email.length > 0) {
    // Later, this will be a first and last name
    const [localPart] = user.email.split('@')
    return localPart
  }

  return 'Account'
}

/** First visible character of the label, uppercased. Falls back to '?'. */
function initialFor(label: string): string {
  const trimmed = label.trim()
  return trimmed.length === 0 ? '?' : trimmed.charAt(0).toUpperCase();
}

function Header() {
  const { user } = useAuth()
  const label = displayLabelFor(user)
  const initial = initialFor(label)

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link to="/" className={styles.brand} aria-label={`${PRODUCT_NAME} home`}>
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className={styles.brandLogo}
            width={36}
            height={36}
          />
          <span className={styles.brandName}>{PRODUCT_NAME}</span>
        </Link>

        {user && (
          <nav className={styles.nav} aria-label="Primary">
            <NavLink
              to="/graph"
              className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}
            >
              Graph
            </NavLink>
            <NavLink
              to="/tasks"
              className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}
            >
              Tasks
            </NavLink>
          </nav>
        )}

        {user ? (
          <NavLink
            to="/profile"
            className={({ isActive }) => clsx(styles.profile, isActive && styles.profileActive)}
            aria-label={`Open profile for ${label}`}
          >
            <span className={styles.profileName}>{label}</span>
            <span className={styles.avatar} aria-hidden="true">
              {/* Replace this span with an <img> once profile photos exist. */}
              {initial}
            </span>
          </NavLink>
        ) : (
          <Link to="/" className={styles.signIn}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}

export default Header
