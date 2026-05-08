import { useEffect } from 'react'
import clsx from 'clsx'
import formStyles from '../styles/formActions.module.css'
import styles from './PanelConfirm.module.css'

type ConfirmVariant = 'primary' | 'danger'

type Props = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: ConfirmVariant
  isConfirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Compact confirmation overlay that fills the nearest positioned ancestor (used
 * inside SidePanel — anchors to .panelRect rather than the viewport).
 */
export function PanelConfirm({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  isConfirming = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConfirming) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel, isConfirming])

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="panel-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) onCancel()
      }}
    >
      <div className={styles.card}>
        <h3 id="panel-confirm-title" className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={clsx(confirmVariant === 'danger' ? formStyles.dangerButton : 'btn-primary')}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
