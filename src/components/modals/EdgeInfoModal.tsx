import { type FormEvent, useEffect, useState } from 'react'
import { deleteEdge } from '../../firebase/graph'
import { edgeHandleLabel } from '../../graph/edgeHandles'
import { isLocalPendingEdgeId } from '../../graph/useDeferredEdgePersistence'
import { Modal } from './Modal'

type Props = {
  userId: string
  edgeId: string
  sourceName: string
  targetName: string
  sourceHandle?: string
  targetHandle?: string
  edgeLabel?: string
  onClose: () => void
  /** Called after the edge is removed from the graph (local queue or Firestore). */
  onEdgeDeleted: (edgeId: string) => void
  /** Persist label: parent handles pending local ids vs Firestore. */
  onSaveEdgeLabel: (edgeId: string, label: string) => Promise<void>
}

export function EdgeInfoModal({
  userId,
  edgeId,
  sourceName,
  targetName,
  sourceHandle,
  targetHandle,
  edgeLabel = '',
  onClose,
  onEdgeDeleted,
  onSaveEdgeLabel,
}: Props) {
  const [label, setLabel] = useState(edgeLabel)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingLabel, setIsSavingLabel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLabel(edgeLabel)
  }, [edgeId, edgeLabel])

  const handleSaveLabel = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSavingLabel(true)
    try {
      await onSaveEdgeLabel(edgeId, label)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save label')
    } finally {
      setIsSavingLabel(false)
    }
  }

  const handleDelete = async () => {
    setError(null)

    if (isLocalPendingEdgeId(edgeId)) {
      onEdgeDeleted(edgeId)
      onClose()
      return
    }

    setIsDeleting(true)

    try {
      await deleteEdge(userId, edgeId, 'context')
      onEdgeDeleted(edgeId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection')
      setIsDeleting(false)
    }
  }

  return (
    <Modal title="Connection" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: '0.75rem' }}>
        <strong style={{ color: '#374151' }}>{sourceName}</strong>
        {' → '}
        <strong style={{ color: '#374151' }}>{targetName}</strong>
      </p>
      {(sourceHandle || targetHandle) ? (
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: '1rem' }}>
          Sides:{' '}
          <span style={{ color: '#374151' }}>{edgeHandleLabel(sourceHandle)}</span>
          {' → '}
          <span style={{ color: '#374151' }}>{edgeHandleLabel(targetHandle)}</span>
        </p>
      ) : null}

      {isLocalPendingEdgeId(edgeId) ? (
        <p style={{ fontSize: 12, color: '#92400e', marginBottom: '1rem' }}>
          This connection is not saved to the server yet. It will be saved when you leave this page, switch tabs, or hide this window.
        </p>
      ) : null}

      <form onSubmit={(ev) => void handleSaveLabel(ev)} className="home-auth-form" style={{ marginBottom: '1rem' }}>
        <label className="home-auth-field">
          <span>Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. visits weekly"
          />
        </label>
        <p style={{ margin: '0.35rem 0 0.75rem', fontSize: 12, color: '#6b7280' }}>
          Shown on the line between the two nodes. Leave blank to remove the label.
        </p>
        <button
          type="submit"
          disabled={isSavingLabel || isDeleting}
          className="home-auth-button"
          style={{ marginTop: 0 }}
        >
          {isSavingLabel ? 'Saving…' : 'Save label'}
        </button>
      </form>

      {error && (
        <p className="home-auth-error" style={{ marginBottom: '0.75rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={isDeleting || isSavingLabel}
          onClick={() => {
            void handleDelete()
          }}
          style={{
            padding: '0.45rem 0.9rem',
            borderRadius: '0.5rem',
            border: '1px solid #fca5a5',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            cursor: isDeleting || isSavingLabel ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: isDeleting || isSavingLabel ? 0.6 : 1,
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
