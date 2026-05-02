import { useEffect, type ReactNode } from 'react'
import styles from './Modal.module.css'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        onClose()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className={styles.dialog}>
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>

          <button type="button" onClick={onClose} aria-label="Close" className={styles.closeButton}>
            ✕
          </button>
        </div>

        {children}
      </div>
    </>
  )
}
