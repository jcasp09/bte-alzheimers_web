import { type SubmitEvent, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { deleteEdge } from '../../data/edges'
import { GRAPH_IDS } from '../../model/types'
import { isLocalPendingEdgeId } from '../../hooks/useDeferredEdgePersistence'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { InlineEditableTitle } from '../../../shared/ui/InlineEditableTitle'
import { LinkedAvatarRow, type LinkedAvatarItem } from '../../../shared/ui/LinkedAvatarRow'
import { SaveCornerButton } from '../../../shared/ui/SaveCornerButton'
import { TrashCornerButton } from '../../../shared/ui/TrashCornerButton'
import { edgeLabelValidator, isValid } from '../../../shared/validation/fieldValidators'
import formStyles from '../../../shared/styles/formActions.module.css'
import styles from './EdgeInfoModal.module.css'

type Props = {
  userId: string
  edgeId: string
  sourceId: string
  targetId: string
  sourceName: string
  targetName: string
  sourcePhotoPath?: string
  targetPhotoPath?: string
  edgeLabel?: string
  onClose: () => void
  /** Called after the edge is removed from the graph (local queue or Firestore). */
  onEdgeDeleted: (edgeId: string) => void
  /** Persist label: parent handles pending local ids vs Firestore. */
  onSaveEdgeLabel: (edgeId: string, label: string) => Promise<void>
  onFocusEndpoint?: (nodeId: string) => void
}

function ConnectionHeroMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={36}
      height={36}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export function EdgeInfoModal({
  userId,
  edgeId,
  sourceId,
  targetId,
  sourceName,
  targetName,
  sourcePhotoPath,
  targetPhotoPath,
  edgeLabel = '',
  onClose,
  onEdgeDeleted,
  onSaveEdgeLabel,
  onFocusEndpoint,
}: Props) {
  const [label, setLabel] = useState(edgeLabel)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingLabel, setIsSavingLabel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLabel(edgeLabel)
    setError(null)
  }, [edgeId, edgeLabel])

  const handleSaveLabel = async (e: SubmitEvent) => {
    e.preventDefault()
    const labelError = edgeLabelValidator.validate(label)
    if (labelError != null) {
      setError(labelError)
      return
    }
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

  const handleConfirmDelete = async () => {
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
  const hasUnsavedChanges = label.trim() !== edgeLabel.trim()
  const labelValid = isValid(edgeLabelValidator, label)
  const isPending = isLocalPendingEdgeId(edgeId)

  const sourceItem: LinkedAvatarItem = useMemo(
    () => ({ id: sourceId, name: sourceName, photoPath: sourcePhotoPath }),
    [sourceId, sourceName, sourcePhotoPath],
  )
  const targetItem: LinkedAvatarItem = useMemo(
    () => ({ id: targetId, name: targetName, photoPath: targetPhotoPath }),
    [targetId, targetName, targetPhotoPath],
  )

  const handleEndpointClick = (id: string) => {
    if (!onFocusEndpoint) return
    onFocusEndpoint(id)
  }

  return (
    <SidePanel
      title={label || 'Connection'}
      titleSlot={
        <InlineEditableTitle
          value={label}
          onChange={setLabel}
          placeholder="Untitled connection"
          ariaLabel="Edit connection label"
          disabled={busy}
          validator={edgeLabelValidator}
        />
      }
      onClose={onClose}
      accent="connection"
      hero={{
        avatarLabel: '',
        avatarSlot: <ConnectionHeroMark />,
      }}
    >
      <form onSubmit={handleSaveLabel} className={clsx('form-stack', styles.editForm)}>
        <section className={styles.endpoints}>
          <div className={styles.endpointSlot}>
            <p className={styles.endpointLabel}>From</p>
            <LinkedAvatarRow
              items={[sourceItem]}
              mode="focus"
              onItemClick={handleEndpointClick}
              disabled={busy || !onFocusEndpoint}
            />
          </div>
          <span className={styles.arrow} aria-hidden="true">→</span>
          <div className={styles.endpointSlot}>
            <p className={styles.endpointLabel}>To</p>
            <LinkedAvatarRow
              items={[targetItem]}
              mode="focus"
              onItemClick={handleEndpointClick}
              disabled={busy || !onFocusEndpoint}
            />
          </div>
        </section>

        <p className={styles.helpText}>
          Tap an endpoint to focus that node. The label is shown on the line between them.
        </p>

        {isPending ? (
          <p className={styles.pendingNote}>
            This connection isn't saved to the server yet. It will sync when you leave this page or switch tabs.
          </p>
        ) : null}

        {error ? (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        ) : null}

        <SaveCornerButton
          visible={hasUnsavedChanges && labelValid}
          busy={isSavingLabel}
          ariaLabel="Save label"
        />
      </form>

      <TrashCornerButton
        onConfirm={handleConfirmDelete}
        ariaLabel="Delete connection"
        confirmTitle="Delete connection"
        confirmMessage={
          isPending
            ? 'Discard this unsaved connection?'
            : 'Permanently delete this connection? This cannot be undone.'
        }
        confirmLabel="Delete connection"
        isBusy={isDeleting}
        disabled={busy}
      />
    </SidePanel>
  )
}
