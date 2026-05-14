import { type SubmitEvent, useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { InlineEditableTitle } from '../../../shared/ui/InlineEditableTitle'
import { InlineEditableField } from '../../../shared/ui/InlineEditableField'
import { SaveCornerButton } from '../../../shared/ui/SaveCornerButton'
import { TrashCornerButton } from '../../../shared/ui/TrashCornerButton'
import { LinkedAvatarRow, type LinkedAvatarItem } from '../../../shared/ui/LinkedAvatarRow'
import { usePublishCanvasLinkMode } from '../../../shared/hooks/usePublishCanvasLinkMode'
import {
  allValid,
  firstError,
  taskDateTimeValidator,
  taskLocationValidator,
  taskTitleValidator,
} from '../../../shared/validation/fieldValidators'
import { computeTaskPriority, updateTaskFields } from '../../data/tasks'
import { deleteNodeAndEdges } from '../../data/nodes'
import { GRAPH_IDS, type PickableNode } from '../../model/types'
import type { UpcomingTask } from '../../data/tasks'
import formStyles from '../../../shared/styles/formActions.module.css'
import styles from './AddTaskModal.module.css'

const ELIGIBLE_TYPES: ReadonlySet<string> = new Set(['person', 'place'])

type CanvasLinkMode = {
  eligibleTypes: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
} | null

type Props = {
  userId: string
  task: UpcomingTask
  pickableNodes: PickableNode[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
  onSetCanvasLinkMode: (mode: CanvasLinkMode) => void
}

function isoToDatetimeLocal(iso: string | undefined): string {
  if (typeof iso !== 'string' || iso.length === 0) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function datetimeLocalToIso(localValue: string): string {
  if (!localValue) return ''
  const d = new Date(localValue)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
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

export function TaskInfoPanel({
  userId,
  task,
  pickableNodes,
  onClose,
  onSaved,
  onDeleted,
  onSetCanvasLinkMode,
}: Props) {
  const initialTitle = typeof task.title === 'string' && task.title.length > 0
    ? task.title
    : (task.name ?? '')
  const initialStart = isoToDatetimeLocal(task.startAt)
  const initialEnd = isoToDatetimeLocal(task.endAt)
  const initialLocation = typeof task.location === 'string' ? task.location : ''
  const initialLinkedIds = useMemo(
    () => (Array.isArray(task.linkedNodeIds) ? [...task.linkedNodeIds] : []),
    [task.linkedNodeIds],
  )

  const [title, setTitle] = useState(initialTitle)
  const [startAt, setStartAt] = useState(initialStart)
  const [endAt, setEndAt] = useState(initialEnd)
  const [location, setLocation] = useState(initialLocation)
  const [linkedIds, setLinkedIds] = useState<string[]>(initialLinkedIds)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state if the underlying task switches (id change).
  useEffect(() => {
    setTitle(initialTitle)
    setStartAt(initialStart)
    setEndAt(initialEnd)
    setLocation(initialLocation)
    setLinkedIds(initialLinkedIds)
    setError(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

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

  const linkedIdsKey = useMemo(() => [...linkedIds].sort().join(','), [linkedIds])
  const initialLinkedIdsKey = useMemo(() => [...initialLinkedIds].sort().join(','), [initialLinkedIds])
  const hasUnsavedChanges =
    title !== initialTitle ||
    startAt !== initialStart ||
    endAt !== initialEnd ||
    location !== initialLocation ||
    linkedIdsKey !== initialLinkedIdsKey

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
    setIsSaving(true)
    try {
      const startAtIso = datetimeLocalToIso(startAt)
      const endAtIso = datetimeLocalToIso(endAt)
      const trimmedTitle = title.trim()
      const trimmedLocation = location.trim()
      await updateTaskFields(userId, task.id, {
        name: trimmedTitle,
        title: trimmedTitle,
        startAt: startAtIso,
        endAt: endAtIso,
        location: trimmedLocation,
        priority: computeTaskPriority(startAtIso),
        linkedNodeIds: [...new Set(linkedIds)],
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await deleteNodeAndEdges(userId, task.id, GRAPH_IDS.tasks)
      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
      setIsDeleting(false)
    }
  }

  const busy = isSaving || isDeleting
  const titlePlaceholder = 'Untitled task'

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
            onChange={setStartAt}
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
            Click people or places on the canvas to link or unlink.
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
          visible={hasUnsavedChanges && formValid}
          busy={isSaving}
          busyLabel="Saving…"
        />
      </form>

      <TrashCornerButton
        onConfirm={handleDelete}
        ariaLabel="Delete task"
        confirmTitle="Delete task"
        confirmMessage="Permanently delete this task? This cannot be undone."
        confirmLabel="Delete task"
        isBusy={isDeleting}
        disabled={busy}
      />
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
