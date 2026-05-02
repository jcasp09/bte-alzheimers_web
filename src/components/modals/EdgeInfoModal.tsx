import { type SubmitEvent, useEffect, useState } from 'react'
import clsx from 'clsx'
import { GRAPH_IDS, deleteEdge } from '../../services/graph'
import { edgeHandleLabel } from '../../graph/edgeHandles'
import { isLocalPendingEdgeId } from '../../hooks/useDeferredEdgePersistence'
import { Modal } from '../ui/Modal'
import modalStyles from '../ui/Modal.module.css'
import styles from './EdgeInfoModal.module.css'

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

  const handleSaveLabel = async (e: SubmitEvent) => {
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
      await deleteEdge(userId, edgeId, GRAPH_IDS.context)
      onEdgeDeleted(edgeId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection')
      setIsDeleting(false)
    }
  }

  const busy = isDeleting || isSavingLabel

  return (
    <Modal title="Connection" onClose={onClose}>
      <p className={styles.summary}>
        <strong>{sourceName}</strong>
        {' → '}
        <strong>{targetName}</strong>
      </p>
      {(sourceHandle || targetHandle) ? (
        <p className={styles.meta}>
          Sides:{' '}
          <span>{edgeHandleLabel(sourceHandle)}</span>
          {' → '}
          <span>{edgeHandleLabel(targetHandle)}</span>
        </p>
      ) : null}

      {isLocalPendingEdgeId(edgeId) ? (
        <p className={styles.pendingWarning}>
          This connection is not saved to the server yet. It will be saved when you leave this page, switch tabs, or hide this window.
        </p>
      ) : null}

      <form
        onSubmit={(ev) => void handleSaveLabel(ev)}
        className={clsx('form-stack', styles.labelForm)}
      >
        <label className="field">
          <span>Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. visits weekly"
          />
        </label>
        <p className={styles.helpText}>
          Shown on the line between the two nodes. Leave blank to remove the label.
        </p>
        <button type="submit" disabled={busy} className="btn-primary">
          {isSavingLabel ? 'Saving…' : 'Save label'}
        </button>
      </form>

      {error && (
        <p className={clsx('text-error', modalStyles.errorText)}>{error}</p>
      )}

      <div className={modalStyles.actionsLeftAligned}>
        <button
          type="button"
          disabled={busy}
          onClick={() => { void handleDelete() }}
          className={modalStyles.dangerButton}
        >
          {isDeleting ? 'Deleting…' : 'Delete connection'}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">
          Close
        </button>
      </div>
    </Modal>
  )
}
