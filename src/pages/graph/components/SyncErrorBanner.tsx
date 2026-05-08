import clsx from 'clsx'
import styles from '../Graph.module.css'

type Props = {
  message: string | null
  onDismiss: () => void
}

/** Floating dismissable banner shown when an edge sync to Firestore fails.
 *  Renders nothing when the message is null. */
export function SyncErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null
  return (
    <div className={styles.bannerFloat}>
      <p className={clsx('text-error', styles.bannerFloatError)}>{message}</p>
      <button
        type="button"
        className={clsx('btn-ghost', styles.bannerFloatDismiss)}
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}
