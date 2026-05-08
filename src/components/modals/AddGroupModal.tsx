import { type SubmitEvent, useState } from 'react'
import clsx from 'clsx'
import { GRAPH_IDS, createNode } from '../../services/graph'
import { Modal } from '../../shared/ui/Modal'
import formStyles from '../../shared/styles/formActions.module.css'

type DraftRect = { x: number; y: number; width: number; height: number }

type Props = {
  userId: string
  draftRect: DraftRect
  onClose: () => void
  onSuccess: () => void
}

export function AddGroupModal({ userId, draftRect, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a group name')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await createNode(
        userId,
        {
          type: 'group',
          name: trimmed,
          position: { x: draftRect.x, y: draftRect.y },
          width: draftRect.width,
          height: draftRect.height,
        },
        GRAPH_IDS.context,
      )
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title="Name your group" onClose={onClose}>
      <p className={formStyles.leadText}>
        Frame: {Math.round(draftRect.width)} × {Math.round(draftRect.height)} px at (
        {Math.round(draftRect.x)}, {Math.round(draftRect.y)}). Drag people and places into the group after you
        create it; deleting the group leaves members on the canvas.
      </p>
      <form onSubmit={(e) => { void handleSubmit(e) }} className="form-stack">
        <label className={clsx('field', formStyles.spacedField)}>
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Family"
            autoFocus
          />
        </label>
        {error ? (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        ) : null}
        <div className={formStyles.actions}>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
