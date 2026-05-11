import { type SubmitEvent, useId, useState } from 'react'
import clsx from 'clsx'
import { createNode } from '../../data/nodes'
import { GRAPH_IDS } from '../../model/types'
import { Modal } from '../../../shared/ui/Modal'
import { groupNameValidator, isValid } from '../../../shared/validation/fieldValidators'
import formStyles from '../../../shared/styles/formActions.module.css'

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
  const errorId = useId()

  const fieldError = groupNameValidator.validate(name)
  const showFieldError = fieldError != null && name.length > 0
  const canSubmit = isValid(groupNameValidator, name)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    const nameError = groupNameValidator.validate(name)
    if (nameError != null) {
      setError(nameError)
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await createNode(
        userId,
        {
          type: 'group',
          name: name.trim(),
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
            maxLength={groupNameValidator.maxLength}
            aria-invalid={showFieldError || undefined}
            aria-describedby={showFieldError ? errorId : undefined}
          />
          {showFieldError ? (
            <p id={errorId} className="text-error" role="alert">{fieldError}</p>
          ) : null}
        </label>
        {error ? (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        ) : null}
        <div className={formStyles.actions}>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || !canSubmit} className="btn-primary">
            {isSubmitting ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
