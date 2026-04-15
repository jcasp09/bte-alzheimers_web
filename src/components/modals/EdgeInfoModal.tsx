import { useState } from 'react'
import { Modal } from './Modal'
import { deleteEdge } from '../../firebase/graph'

type Props = {
  userId: string
  edgeId: string
  sourceName: string
  targetName: string
  onClose: () => void
  onSuccess: () => void
}

export function EdgeInfoModal({ userId, edgeId, sourceName, targetName, onClose, onSuccess }: Props) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)

    try {
      await deleteEdge(userId, edgeId, 'context')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection')
      setIsDeleting(false)
    }
  }

  return (
    <Modal title="Connection" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: '1.25rem' }}>
        <strong style={{ color: '#374151' }}>{sourceName}</strong>
        {' → '}
        <strong style={{ color: '#374151' }}>{targetName}</strong>
      </p>

      {error && (
        <p className="home-auth-error" style={{ marginBottom: '0.75rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={isDeleting}
          onClick={handleDelete}
          style={{
            padding: '0.45rem 0.9rem',
            borderRadius: '0.5rem',
            border: '1px solid #fca5a5',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: isDeleting ? 0.6 : 1,
          }}
        >
          {isDeleting ? 'Deleting…' : 'Delete connection'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="home-auth-toggle-button"
          style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
        >
          Close
        </button>
      </div>
    </Modal>
  )
}