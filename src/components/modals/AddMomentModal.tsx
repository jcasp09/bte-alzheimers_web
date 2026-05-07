import { type FormEvent, useState } from 'react'
import clsx from 'clsx'
import { createMoment, parseOccurredOn } from '../../firebase/moments'
import { MultiEntityPicker, type PickerItem } from '../MultiEntityPicker'
import { SidePanel } from '../ui/SidePanel'
import formStyles from '../../styles/formActions.module.css'
import { getInitialsForAvatar } from '../../util/initials'

type Props = {
  userId: string
  people: PickerItem[]
  onClose: () => void
  onCreated: () => Promise<void> | void
}

export function AddMomentModal({ userId, people, onClose, onCreated }: Props) {
  const [momentTitle, setMomentTitle] = useState('')
  const [momentDate, setMomentDate] = useState('')
  const [momentDescription, setMomentDescription] = useState('')
  const [momentPersonIds, setMomentPersonIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!momentTitle.trim()) {
      setError('Moment name is required.')
      return
    }
    if (!momentDate || !parseOccurredOn(momentDate)) {
      setError('Choose a valid date.')
      return
    }

    setIsSubmitting(true)
    try {
      await createMoment(userId, {
        title: momentTitle.trim(),
        description: momentDescription.trim(),
        occurredOn: momentDate,
        personNodeIds: momentPersonIds,
        placeNodeIds: [],
      })
      await onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create moment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SidePanel
      title="Add a moment"
      onClose={onClose}
      accent="moment"
      hero={{ avatarLabel: getInitialsForAvatar(momentTitle) }}
    >
      <form onSubmit={handleSubmit} className="form-stack">
        {error ? <p className={clsx('text-error', formStyles.errorText)}>{error}</p> : null}

        <label className="field">
          <span>Name</span>
          <input
            type="text"
            required
            value={momentTitle}
            onChange={(e) => setMomentTitle(e.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="field">
          <span>Date</span>
          <input
            type="date"
            required
            value={momentDate}
            onChange={(e) => setMomentDate(e.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="field">
          <span>Journal / description (optional)</span>
          <textarea
            value={momentDescription}
            onChange={(e) => setMomentDescription(e.target.value)}
            rows={4}
            disabled={isSubmitting}
          />
        </label>

        <MultiEntityPicker
          label="People at this moment"
          max={10}
          items={people}
          selectedIds={momentPersonIds}
          onChange={setMomentPersonIds}
          disabled={isSubmitting}
        />

        <div className={formStyles.actions}>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Saving…' : 'Save moment'}
          </button>
        </div>
      </form>
    </SidePanel>
  )
}
