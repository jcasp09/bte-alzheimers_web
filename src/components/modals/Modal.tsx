import { useEffect, type ReactNode } from 'react'

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
      <div onClick={onClose} style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
        zIndex: 1000,
      }}/>

      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        background: '#fff',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '460px',
        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.18)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}>
          <h2 id="modal-title" style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            {title}
          </h2>

          <button type="button" onClick={onClose} aria-label="Close" style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            color: '#6b7280',
            padding: '0.25rem',
            lineHeight: 1,
            borderRadius: '0.25rem'
          }}>
            ✕
          </button>
        </div>

        {children}
      </div>
    </>
  )
}
