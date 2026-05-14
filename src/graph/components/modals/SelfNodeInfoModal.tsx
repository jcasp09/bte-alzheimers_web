import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { getInitialsForAvatar } from '../../../shared/util/initials'
import styles from './SelfNodeInfoModal.module.css'

type Props = {
  onClose: () => void
}

export function SelfNodeInfoModal({ onClose }: Props) {
  const { user, profile } = useAuth()

  const firstName = profile?.firstName?.trim() ?? ''
  const lastName = profile?.lastName?.trim() ?? ''
  const fullName = [firstName, lastName].filter((s) => s.length > 0).join(' ')
  const displayName = fullName || user?.displayName || 'You'
  const photoURL = profile?.photoURL ?? user?.photoURL ?? undefined
  const email = user?.email ?? ''
  const initials = getInitialsForAvatar(displayName) || 'You'

  return (
    <SidePanel
      title={displayName}
      onClose={onClose}
      accent="neutral"
      subtitle={<span className={styles.subtitle}>This is you — the center of your graph.</span>}
      hero={{
        avatarLabel: initials,
        avatarImageUrl: photoURL,
      }}
    >
      <div className={styles.body}>
        {email ? (
          <section className={styles.field}>
            <p className={styles.fieldLabel}>Email</p>
            <p className={styles.fieldValue}>{email}</p>
          </section>
        ) : null}

        <p className={styles.helpText}>
          Your name and photo come from your account settings. Edit them there
          and they update everywhere they appear.
        </p>

        <Link
          to="/settings/account"
          className={styles.editLink}
          onClick={onClose}
        >
          Edit in Account settings
        </Link>
      </div>
    </SidePanel>
  )
}
