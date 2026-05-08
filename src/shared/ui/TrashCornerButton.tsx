import { useState } from 'react'
import { PanelConfirm } from './PanelConfirm'
import { TrashIcon } from './icons'
import styles from './TrashCornerButton.module.css'

type Props = {
  onConfirm: () => void | Promise<void>
  ariaLabel: string
  confirmTitle: string
  confirmMessage: string
  confirmLabel?: string
  isBusy?: boolean
  disabled?: boolean
}

export function TrashCornerButton({
    onConfirm,
    ariaLabel,
    confirmTitle,
    confirmMessage,
    confirmLabel = 'Delete',
    isBusy,
    disabled,
  }: Props) {
  const [open, setOpen] = useState(false)

  const handleConfirm = async () => {
    await onConfirm()
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(true)}
        disabled={disabled || isBusy}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <TrashIcon size={18} />
      </button>

      {open && (
        <PanelConfirm
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={confirmLabel}
          confirmVariant="danger"
          isConfirming={!!isBusy}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setOpen(false)}
        />
      )}
     </>
  )
}
