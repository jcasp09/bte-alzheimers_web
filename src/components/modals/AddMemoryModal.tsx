import { type SubmitEvent, useState } from 'react'
import clsx from 'clsx'
import { createMemory, parseOccurredOn } from '../../firebase/memories'
import { MultiEntityPicker, type PickerItem } from '../../shared/ui/MultiEntityPicker'
import { SidePanel } from '../../shared/ui/SidePanel'
import formStyles from '../../shared/styles/formActions.module.css'
import { getInitialsForAvatar } from '../../shared/util/initials'

type Props = {
  userId: string
  people: PickerItem[]
  onClose: () => void
  onCreated: () => Promise<void> | void
}

export function AddMemoryModal({ userId, people, onClose, onCreated }: Props) {
  const [memoryTitle, setMemoryTitle] = useState('')
  const [memoryDate, setMemoryDate] = useState('')
  const [memoryDescription, setMemoryDescription] = useState('')
  const [memoryPersonIds, setMemoryPersonIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setError(null)

    if (!memoryTitle.trim()) {
      setError('Memory name is required.')
      return
    }
    if (!memoryDate || !parseOccurredOn(memoryDate)) {
      setError('Choose a valid date.')
      return
    }

    setIsSubmitting(true)
    try {
      await createMemory(userId, {
        title: memoryTitle.trim(),
        description: memoryDescription.trim(),
        occurredOn: memoryDate,
        personNodeIds: memoryPersonIds,
        placeNodeIds: [],
      })
      await onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memory')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SidePanel
      title="Add a memory"
      onClose={onClose}
      accent="memory"
      hero={{ avatarLabel: getInitialsForAvatar(memoryTitle) }}
    >
      <form onSubmit={handleSubmit} className="form-stack">
        {error ? <p className={clsx('text-error', formStyles.errorText)}>{error}</p> : null}

        <label className="field">
          <span>Name</span>
          <input
            type="text"
            required
            value={memoryTitle}
            onChange={(e) => setMemoryTitle(e.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="field">
          <span>Date</span>
          <input
            type="date"
            required
            value={memoryDate}
            onChange={(e) => setMemoryDate(e.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="field">
          <span>Journal / description (optional)</span>
          <textarea
            value={memoryDescription}
            onChange={(e) => setMemoryDescription(e.target.value)}
            rows={4}
            disabled={isSubmitting}
          />
        </label>

        <MultiEntityPicker
          label="People at this memory"
          max={10}
          items={people}
          selectedIds={memoryPersonIds}
          onChange={setMemoryPersonIds}
          disabled={isSubmitting}
        />

        <div className={formStyles.actions}>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Saving…' : 'Save memory'}
          </button>
        </div>
      </form>
    </SidePanel>
  )
}
