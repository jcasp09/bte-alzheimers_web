import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import type { Profile } from '../contexts/AuthContext'
import styles from './Header.module.css'

const PRODUCT_NAME = 'Memory Jog'

type LabelSource = {
  displayName?: string | null
  email?: string | null
}

/**
 * Build the profile pill's display label, preferring the live Firestore name,
 * then the cached Firebase Auth displayName, then the email's local part.
 */
function displayLabelFor(user: LabelSource | null, profile: Profile | null): string {
  if (user == null)
    return 'Sign in'

  if (profile != null) {
    const fullName = [profile.firstName, profile.lastName]
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join(' ')
    if (fullName.length > 0)
      return fullName
  }

  if (user.displayName != null && user.displayName.trim() !== '')
    return user.displayName

  if (user.email != null && user.email.length > 0) {
    const [localPart] = user.email.split('@')
    return localPart
  }

  return 'Account'
}

/** First visible character of the label, uppercased. Falls back to '?'. */
function initialFor(label: string): string {
  const trimmed = label.trim()
  return trimmed.length === 0 ? '?' : trimmed.charAt(0).toUpperCase()
}

function Header() {
  const { user, profile } = useAuth()
  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null)

  const label = displayLabelFor(user, profile)
  const initial = initialFor(label)
  const photoURL = profile?.photoURL ?? null
  const showPhoto = photoURL != null && photoURL !== failedPhotoURL

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
              to="/moments"
              className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}
            >
              Moments
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
            to="/settings"
            className={({ isActive }) => clsx(styles.profile, isActive && styles.profileActive)}
            aria-label={`Open account settings for ${label}`}
          >
            <span className={styles.profileName}>{label}</span>
            <span className={styles.avatar} aria-hidden="true">
              {showPhoto && photoURL != null ? (
                <img
                  src={photoURL}
                  alt=""
                  className={styles.avatarImage}
                  onError={() => setFailedPhotoURL(photoURL)}
                />
              ) : (
                initial
              )}
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
