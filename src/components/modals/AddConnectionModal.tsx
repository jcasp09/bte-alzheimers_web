import { useState } from 'react'
import clsx from 'clsx'
import type { Connection } from '@xyflow/react'
import type { PickableNode } from '../../types/graph'
import { EDGE_SIDES, sourceHandleForSide, targetHandleForSide, type EdgeSide } from '../../graph/edgeHandles'
import { Modal } from '../ui/Modal'
import modalStyles from '../ui/Modal.module.css'
import styles from './AddConnectionModal.module.css'

type Props = {
  pickableNodes: PickableNode[]
  onClose: () => void
  /** Adds the edge to local graph state; Firestore write is deferred by the parent. */
  onQueueConnection: (
    connection: Connection,
    opts?: { label?: string },
  ) => string | null
}

export function AddConnectionModal({ pickableNodes, onClose, onQueueConnection }: Props) {
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [sourceSide, setSourceSide] = useState<EdgeSide>('bottom')
  const [targetSide, setTargetSide] = useState<EdgeSide>('top')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionLabel, setConnectionLabel] = useState('')

  const connectableNodes = pickableNodes

  const handleAdd = async () => {
    if (!sourceId || !targetId) {
      return
    }

    if (sourceId === targetId) {
      setError('Source and target node cannot be the same');
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      onQueueConnection(
        {
          source: sourceId,
          target: targetId,
          sourceHandle: sourceHandleForSide(sourceSide),
          targetHandle: targetHandleForSide(targetSide),
        },
        { label: connectionLabel.trim() || undefined },
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection')
    } finally {
      setIsSubmitting(false)
    }
  }

  const nodeList = (
    label: string,
    selectedId: string | null,
    onSelect: (id: string) => void,
  ) => (
    <div className={styles.pickerColumn}>
      <p className={styles.pickerLabel}>{label}</p>
      <ul className={styles.pickerList}>
        {connectableNodes.length === 0 ? (
          <li className={styles.pickerEmpty}>
            No people or places to connect yet.
          </li>
        ) : (
          connectableNodes.map((node) => (
            <li
              key={node.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(node.id)
                }
              }}
              className={clsx(styles.pickerItem, selectedId === node.id && styles.pickerItemSelected)}
            >
              {node.name}
              <span className={styles.pickerItemTypeLabel}>
                {node.type}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )

  const sidePicker = (
    label: string,
    value: EdgeSide,
    onChange: (side: EdgeSide) => void,
  ) => (
    <div className={styles.sidePicker}>
      <p className={styles.sidePickerLabel}>{label}</p>
      <div className={styles.sideOptionRow}>
        {EDGE_SIDES.map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => onChange(side)}
            className={clsx(styles.sideOption, value === side && styles.sideOptionSelected)}
          >
            {side.charAt(0).toUpperCase() + side.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Modal title="Add Connection" onClose={onClose}>
      <p className={modalStyles.leadText}>
        Select a source and target node, then which side of each node the link uses (same as dragging between handles on the graph).
      </p>

      <div className={styles.pickerRow}>
        {nodeList('From', sourceId, setSourceId)}

        <div className={styles.arrowSeparator}>→</div>

        {nodeList('To', targetId, setTargetId)}
      </div>

      <div className={styles.sidePickerGrid}>
        {sidePicker('From side (outgoing)', sourceSide, setSourceSide)}
        {sidePicker('To side (incoming)', targetSide, setTargetSide)}
      </div>

      <div className={styles.labelField}>
        <label className="field">
          <span>Label (optional)</span>
          <input
            type="text"
            value={connectionLabel}
            onChange={(e) => setConnectionLabel(e.target.value)}
            placeholder="Shown on the connection line"
          />
        </label>
      </div>

      {/* Preview of selected connection */}
      {(sourceId || targetId) && (
        <div className={styles.preview}>
          <span className={styles.previewName}>
            {sourceId
              ? (connectableNodes.find((n) => n.id === sourceId)?.name ?? '…')
              : '—'}
          </span>
          <span className={styles.previewArrow}>→</span>
          <span className={styles.previewName}>
            {targetId
              ? (connectableNodes.find((n) => n.id === targetId)?.name ?? '…')
              : '—'}
          </span>
        </div>
      )}

      {error != null && (
        <p className={clsx('text-error', modalStyles.errorText)}>{error}</p>
      )}

      <div className={modalStyles.actions}>
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          disabled={!sourceId || !targetId || isSubmitting}
          className="btn-primary"
          onClick={handleAdd}
        >
          {isSubmitting ? 'Adding…' : 'Add connection'}
        </button>
      </div>
    </Modal>
  )
}
