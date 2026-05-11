import { useEffect } from 'react'
import clsx from 'clsx'
import styles from './ErrorToast.module.css'

type Props = {
  message: string | null
  nonce: number
  onDismiss: () => void
  durationMs?: number
  className?: string
}

/** Floating, animated error toast. */
export function ErrorToast({ message, nonce, onDismiss, durationMs = 3500, className }: Props) {
  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(id)
  }, [message, nonce, durationMs, onDismiss])

  if (!message) return null

  return (
    <div
      key={nonce}
      className={clsx(styles.toast, className)}
      role="alert"
      aria-live="assertive"
    >
      <span className={styles.icon} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        </svg>
      </span>
      <p className={styles.message}>{message}</p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
