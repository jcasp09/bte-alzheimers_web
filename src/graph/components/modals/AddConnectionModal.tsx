import { type SubmitEvent, useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Connection } from '@xyflow/react'
import type { PickableNode } from '../../model/types'
import { EDGE_SIDES, sourceHandleForSide, targetHandleForSide, type EdgeSide } from '../../model/edgeHandles'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { SaveCornerButton } from '../../../shared/ui/SaveCornerButton'
import { LinkedAvatarRow, type LinkedAvatarItem } from '../../../shared/ui/LinkedAvatarRow'
import { InlineEditableField } from '../../../shared/ui/InlineEditableField'
import { usePublishCanvasLinkMode } from '../../../shared/hooks/usePublishCanvasLinkMode'
import formStyles from '../../../shared/styles/formActions.module.css'
import styles from './AddConnectionModal.module.css'

export type AddConnectionCanvasLinkMode = {
  eligibleTypes: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
} | null

type Props = {
  pickableNodes: PickableNode[]
  onClose: () => void
  /** Adds the edge to local graph state; Firestore write is deferred by the parent. */
  onQueueConnection: (
    connection: Connection,
    opts?: { label?: string },
  ) => string | null
  onSetCanvasLinkMode: (mode: AddConnectionCanvasLinkMode) => void
}

const ELIGIBLE_TYPES: ReadonlySet<string> = new Set(['person', 'place'])

export function AddConnectionModal({
  pickableNodes,
  onClose,
  onQueueConnection,
  onSetCanvasLinkMode,
}: Props) {
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [sourceSide, setSourceSide] = useState<EdgeSide>('bottom')
  const [targetSide, setTargetSide] = useState<EdgeSide>('top')
  const [connectionLabel, setConnectionLabel] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedIds = useMemo(() => {
    const out: string[] = []
    if (sourceId) out.push(sourceId)
    if (targetId) out.push(targetId)
    return out
  }, [sourceId, targetId])

  // Two-stage canvas pick: first click sets source, second sets target;
  // clicking an end again clears it; clicking a fresh node with both filled
  // replaces the target.
  const handleLinkToggle = useCallback(
    (id: string) => {
      setError(null)
      if (id === sourceId) {
        setSourceId(null)
        return
      }
      if (id === targetId) {
        setTargetId(null)
        return
      }
      if (sourceId == null) {
        setSourceId(id)
        return
      }
      setTargetId(id)
    },
    [sourceId, targetId],
  )

  usePublishCanvasLinkMode(onSetCanvasLinkMode, ELIGIBLE_TYPES, selectedIds, handleLinkToggle)

  const sourceItem: LinkedAvatarItem | null = useMemo(() => {
    if (!sourceId) return null
    const n = pickableNodes.find((p) => p.id === sourceId)
    return n ? { id: n.id, name: n.name, photoPath: n.photoPath } : null
  }, [pickableNodes, sourceId])
  const targetItem: LinkedAvatarItem | null = useMemo(() => {
    if (!targetId) return null
    const n = pickableNodes.find((p) => p.id === targetId)
    return n ? { id: n.id, name: n.name, photoPath: n.photoPath } : null
  }, [pickableNodes, targetId])

  const canSave =
    sourceId != null && targetId != null && sourceId !== targetId

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!canSave || sourceId == null || targetId == null) return
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

  return (
    <SidePanel
      title="Add a connection"
      onClose={onClose}
      accent="connection"
    >
      <form onSubmit={handleSubmit} className={clsx('form-stack', styles.editForm)}>
        <p className={styles.help}>
          Click two nodes on the canvas to connect them.
        </p>

        <section className={styles.endSection}>
          <p className={styles.sectionLabel}><strong>From</strong></p>
          {sourceItem ? (
            <LinkedAvatarRow
              items={[sourceItem]}
              mode="remove"
              onItemClick={() => setSourceId(null)}
              disabled={isSubmitting}
            />
          ) : (
            <p className={styles.emptyEnd}>Click the first node on the canvas.</p>
          )}
        </section>

        <section className={styles.endSection}>
          <p className={styles.sectionLabel}><strong>To</strong></p>
          {targetItem ? (
            <LinkedAvatarRow
              items={[targetItem]}
              mode="remove"
              onItemClick={() => setTargetId(null)}
              disabled={isSubmitting}
            />
          ) : (
            <p className={styles.emptyEnd}>Click the second node on the canvas.</p>
          )}
        </section>

        <section className={styles.sidesSection}>
          <p className={styles.sectionLabel}><strong>Sides</strong></p>
          <div className={styles.sidePickerRow}>
            <span className={styles.sidePickerLabel}>From side</span>
            <div className={styles.sideOptions}>
              {EDGE_SIDES.map((side) => (
                <button
                  key={`from-${side}`}
                  type="button"
                  onClick={() => setSourceSide(side)}
                  className={clsx(styles.sideOption, sourceSide === side && styles.sideOptionSelected)}
                >
                  {side.charAt(0).toUpperCase() + side.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.sidePickerRow}>
            <span className={styles.sidePickerLabel}>To side</span>
            <div className={styles.sideOptions}>
              {EDGE_SIDES.map((side) => (
                <button
                  key={`to-${side}`}
                  type="button"
                  onClick={() => setTargetSide(side)}
                  className={clsx(styles.sideOption, targetSide === side && styles.sideOptionSelected)}
                >
                  {side.charAt(0).toUpperCase() + side.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <InlineEditableField
          label="Label"
          value={connectionLabel}
          onChange={setConnectionLabel}
          placeholder="Click to add a label"
          disabled={isSubmitting}
        />

        {error ? (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        ) : null}

        <SaveCornerButton
          visible={canSave}
          busy={isSubmitting}
          label="Add"
          ariaLabel="Add connection"
        />
      </form>
    </SidePanel>
  )
}
