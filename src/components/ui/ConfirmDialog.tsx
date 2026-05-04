import { Modal } from './Modal'
import modalStyles from './Modal.module.css'

type ConfirmVariant = 'primary' | 'danger'

type ConfirmDialogProps = {
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
 * Modal that asks the user to confirm an action.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleClose = isConfirming ? () => {} : onCancel

  return (
    <Modal title={title} onClose={handleClose}>
      <p className={modalStyles.leadText}>{message}</p>
      <div className={modalStyles.actions}>
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
          className={confirmVariant === 'danger' ? modalStyles.dangerButton : 'btn-primary'}
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
