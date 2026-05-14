import { type SubmitEvent, useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { InlineEditableTitle } from '../../../shared/ui/InlineEditableTitle'
import { InlineEditableField } from '../../../shared/ui/InlineEditableField'
import { SaveCornerButton } from '../../../shared/ui/SaveCornerButton'
import { LinkedAvatarRow, type LinkedAvatarItem } from '../../../shared/ui/LinkedAvatarRow'
import { usePublishCanvasLinkMode } from '../../../shared/hooks/usePublishCanvasLinkMode'
import {
  allValid,
  firstError,
  taskDateTimeValidator,
  taskLocationValidator,
  taskTitleValidator,
} from '../../../shared/validation/fieldValidators'
import { computeTaskPriority, createTaskNode } from '../../data/tasks'
import type { PickableNode } from '../../model/types'
import formStyles from '../../../shared/styles/formActions.module.css'
import styles from './AddTaskModal.module.css'

const ELIGIBLE_TYPES: ReadonlySet<string> = new Set(['person', 'place'])

export type AddTaskCanvasLinkMode = {
  eligibleTypes: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
} | null

type Props = {
  userId: string
  pickableNodes: PickableNode[]
  onClose: () => void
  onSuccess: () => void
  onSetCanvasLinkMode: (mode: AddTaskCanvasLinkMode) => void
}

function formatDateTimeForDisplay(raw: string): string {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateTime(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

/** Default start time: the next half-hour mark, in local time. */
function defaultStartLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  return formatDateTime(d)
}

/** Add one hour to a `datetime-local` value to seed the end-time default. */
function plusOneHourLocal(start: string): string {
  const d = new Date(start)
  if (Number.isNaN(d.getTime())) return start
  d.setHours(d.getHours() + 1)
  return formatDateTime(d)
}

export function AddTaskPanel({
  userId,
  pickableNodes,
  onClose,
  onSuccess,
  onSetCanvasLinkMode,
}: Props) {
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState<string>(() => defaultStartLocal())
  const [endAt, setEndAt] = useState<string>(() => plusOneHourLocal(defaultStartLocal()))
  const [location, setLocation] = useState('')
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLinkToggle = useCallback(
    (id: string) =>
      setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  )
  usePublishCanvasLinkMode(onSetCanvasLinkMode, ELIGIBLE_TYPES, linkedIds, handleLinkToggle)

  const linkedNodes = useMemo(
    () =>
      linkedIds
        .map((id) => pickableNodes.find((n) => n.id === id))
        .filter((n): n is PickableNode => n != null),
    [linkedIds, pickableNodes],
  )
  const linkedPeople: LinkedAvatarItem[] = linkedNodes
    .filter((n) => n.type === 'person')
    .map((n) => ({ id: n.id, name: n.name, photoPath: n.photoPath }))
  const linkedPlaces: LinkedAvatarItem[] = linkedNodes
    .filter((n) => n.type === 'place')
    .map((n) => ({ id: n.id, name: n.name, photoPath: n.photoPath }))

  const endAfterStartError = useMemo<string | null>(() => {
    if (!startAt || !endAt) return null
    const s = new Date(startAt).getTime()
    const e = new Date(endAt).getTime()
    if (Number.isNaN(s) || Number.isNaN(e)) return null
    return e < s ? 'End time must be after the start time.' : null
  }, [startAt, endAt])

  const baseValid = allValid([
    [taskTitleValidator, title],
    [taskDateTimeValidator, startAt],
    [taskDateTimeValidator, endAt],
    [taskLocationValidator, location],
  ])
  const formValid = baseValid && endAfterStartError == null

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    const firstFieldError = firstError([
      [taskTitleValidator, title],
      [taskDateTimeValidator, startAt],
      [taskDateTimeValidator, endAt],
      [taskLocationValidator, location],
    ])
    if (firstFieldError != null) {
      setError(firstFieldError)
      return
    }
    if (endAfterStartError != null) {
      setError(endAfterStartError)
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const startAtIso = new Date(startAt).toISOString()
      const endAtIso = new Date(endAt).toISOString()
      const trimmedTitle = title.trim()
      const trimmedLocation = location.trim()
      await createTaskNode(userId, {
        type: 'task',
        name: trimmedTitle,
        title: trimmedTitle,
        startAt: startAtIso,
        endAt: endAtIso,
        calendarEventId: '',
        priority: computeTaskPriority(startAtIso),
        location: trimmedLocation.length > 0 ? trimmedLocation : undefined,
        linkedNodeIds: [...new Set(linkedIds)],
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  const busy = isSubmitting
  const titlePlaceholder = 'Add a task'

  return (
    <SidePanel
      title={title || titlePlaceholder}
      titleSlot={
        <InlineEditableTitle
          value={title}
          onChange={setTitle}
          placeholder={titlePlaceholder}
          ariaLabel="Edit task name"
          disabled={busy}
          validator={taskTitleValidator}
        />
      }
      onClose={onClose}
      accent="neutral"
      hero={{
        avatarSlot: (
          <span className={styles.heroIconWrap} aria-hidden="true">
            <TaskHeroIcon />
          </span>
        ),
      }}
    >
      <form onSubmit={handleSubmit} className={clsx('form-stack', styles.editForm)}>
        <div className={styles.fieldList}>
          <InlineEditableField
            label="Starts"
            kind="datetime-local"
            value={startAt}
            onChange={(next) => {
              setStartAt(next)
              if (next && (!endAt || new Date(endAt).getTime() <= new Date(next).getTime())) {
                setEndAt(plusOneHourLocal(next))
              }
            }}
            disabled={busy}
            validator={taskDateTimeValidator}
            formatDisplay={formatDateTimeForDisplay}
          />
          <InlineEditableField
            label="Ends"
            kind="datetime-local"
            value={endAt}
            onChange={setEndAt}
            disabled={busy}
            validator={taskDateTimeValidator}
            formatDisplay={formatDateTimeForDisplay}
          />
          <InlineEditableField
            label="Location"
            value={location}
            onChange={setLocation}
            disabled={busy}
            validator={taskLocationValidator}
            placeholder="Add a location"
          />
        </div>

        <section className={styles.networkSection} aria-label="Linked to">
          <p className={styles.networkHeading}>Linked to</p>
          <p className={styles.connectionsHelp}>
            Click people or places on the canvas to link.
          </p>

          <div className={styles.linksSection}>
            <p className={styles.sectionLabel}>
              <strong>People</strong>
            </p>
            {linkedPeople.length > 0 ? (
              <LinkedAvatarRow
                items={linkedPeople}
                mode="remove"
                onItemClick={(id) =>
                  setLinkedIds((prev) => prev.filter((x) => x !== id))
                }
                disabled={busy}
              />
            ) : (
              <p className={styles.linksEmpty}>None linked yet.</p>
            )}
          </div>

          <div className={styles.linksSection}>
            <p className={styles.sectionLabel}>
              <strong>Places</strong>
            </p>
            {linkedPlaces.length > 0 ? (
              <LinkedAvatarRow
                items={linkedPlaces}
                mode="remove"
                onItemClick={(id) =>
                  setLinkedIds((prev) => prev.filter((x) => x !== id))
                }
                disabled={busy}
              />
            ) : (
              <p className={styles.linksEmpty}>None linked yet.</p>
            )}
          </div>
        </section>

        {error || endAfterStartError ? (
          <p className={clsx('text-error', formStyles.errorText)}>
            {error ?? endAfterStartError}
          </p>
        ) : null}

        <SaveCornerButton
          visible={formValid}
          busy={busy}
          busyLabel="Saving…"
          label="Add"
          ariaLabel="Add task"
        />
      </form>
    </SidePanel>
  )
}

function TaskHeroIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <line x1="3.5" y1="9" x2="20.5" y2="9" />
      <line x1="8" y1="3" x2="8" y2="6" />
      <line x1="16" y1="3" x2="16" y2="6" />
      <polyline points="8 14 11 17 16 12" />
    </svg>
  )
}
