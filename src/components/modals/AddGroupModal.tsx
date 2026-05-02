import { type FormEvent, useState } from 'react'
import { GRAPH_IDS, createNode } from '../../firebase/graph'
import { Modal } from './Modal'

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
        Frame: {Math.round(draftRect.width)} × {Math.round(draftRect.height)} px at (
        {Math.round(draftRect.x)}, {Math.round(draftRect.y)}). Drag people and places into the group after you
        create it; deleting the group leaves members on the canvas.
      </p>
      <form onSubmit={(e) => { void handleSubmit(e) }} className="home-auth-form">
        <label className="home-auth-field" style={{ marginBottom: '1rem' }}>
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
          <p className="home-auth-error" style={{ marginBottom: '0.75rem' }}>{error}</p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="home-auth-toggle-button"
            style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
          >
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="home-auth-button" style={{ marginTop: 0 }}>
            {isSubmitting ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
