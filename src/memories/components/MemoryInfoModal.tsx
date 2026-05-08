import { type SubmitEvent, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { getDownloadURL, ref } from 'firebase/storage'
import {
  MAX_PHOTOS_PER_MEMORY,
  type MemoryDoc,
  deleteMemory,
  parseOccurredOn,
  updateMemory,
} from '../data/memories'
import { deleteMemoryPhotoByPath, uploadMemoryPhoto } from '../data/photos'
import { storage } from '../../firebase/storage'
import { SidePanel } from '../../shared/ui/SidePanel'
import { InlineEditableTitle } from '../../shared/ui/InlineEditableTitle'
import { InlineEditableSubtitle } from '../../shared/ui/InlineEditableSubtitle'
import { InlineEditableField } from '../../shared/ui/InlineEditableField'
import { EditableAvatar } from '../../shared/ui/EditableAvatar'
import { TrashCornerButton } from '../../shared/ui/TrashCornerButton'
import { SaveCornerButton } from '../../shared/ui/SaveCornerButton'
import { PhotoGalleryGrid } from '../../shared/ui/PhotoGalleryGrid'
import { PeoplePicker, type PeoplePickerItem } from '../../shared/ui/PeoplePicker'
import { getInitialsForAvatar } from '../../shared/util/initials'
import { usePhotoUrl } from '../../shared/hooks/usePhotoUrl'
import formStyles from '../../shared/styles/formActions.module.css'
import styles from './MemoryInfoModal.module.css'

type Props = {
  userId: string
  memory: MemoryDoc
  people: PeoplePickerItem[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function formatHumanDate(occurredOn: string): string {
  const parts = parseOccurredOn(occurredOn)
  if (!parts) return occurredOn
  return `${MONTHS[parts.m - 1]} ${parts.d}, ${parts.y}`
}

export function MemoryInfoModal({
  userId,
  memory,
  people,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [title, setTitle] = useState(memory.title)
  const [occurredOn, setOccurredOn] = useState(memory.occurredOn)
  const [description, setDescription] = useState(memory.description)
  const [personNodeIds, setPersonNodeIds] = useState<string[]>(memory.personNodeIds)

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [removingPath, setRemovingPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const paths = useMemo(() => memory.photoPaths ?? [], [memory.photoPaths])

  useEffect(() => {
    setTitle(memory.title)
    setOccurredOn(memory.occurredOn)
    setDescription(memory.description)
    setPersonNodeIds(memory.personNodeIds)
    setError(null)
  }, [
    memory.id,
    memory.title,
    memory.occurredOn,
    memory.description,
    memory.personNodeIds,
  ])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const results = await Promise.all(
        paths.map(async (p) => {
          try {
            return [p, await getDownloadURL(ref(storage, p))] as const
          } catch {
            return null
          }
        }),
      )
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const r of results) {
        if (r) next[r[0]] = r[1]
      }
      setPhotoUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [memory.id, paths])

  const heroPhotoPath = paths[0] ?? ''
  const heroPhotoUrl = usePhotoUrl(heroPhotoPath || undefined)

  const busy = isSaving || isDeleting || isUploading

  const hasUnsavedChanges = (() => {
    if (title !== memory.title) return true
    if (description !== memory.description) return true
    if (occurredOn !== memory.occurredOn) return true
    const a = JSON.stringify([...personNodeIds].sort())
    const b = JSON.stringify([...memory.personNodeIds].sort())
    return a !== b
  })()

  const handleSave = async (e: SubmitEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Memory name is required.')
      return
    }
    if (!parseOccurredOn(occurredOn)) {
      setError('Use a valid calendar date (YYYY-MM-DD).')
      return
    }

    const patch: Parameters<typeof updateMemory>[2] = {}
    if (trimmedTitle !== memory.title) patch.title = trimmedTitle
    if (description !== memory.description) patch.description = description
    if (occurredOn !== memory.occurredOn) patch.occurredOn = occurredOn
    const a = JSON.stringify([...personNodeIds].sort())
    const b = JSON.stringify([...memory.personNodeIds].sort())
    if (a !== b) patch.personNodeIds = personNodeIds

    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }

    setIsSaving(true)
    try {
      await updateMemory(userId, memory.id, patch)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memory')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddPhoto = async (file: File) => {
    if (paths.length >= MAX_PHOTOS_PER_MEMORY) {
      setError(`You can add at most ${MAX_PHOTOS_PER_MEMORY} photos per memory.`)
      return
    }
    setError(null)
    setIsUploading(true)
    try {
      const { path } = await uploadMemoryPhoto(userId, memory.id, file)
      const nextPaths = [...paths, path]
      await updateMemory(userId, memory.id, { photoPaths: nextPaths })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAvatarPhoto = async (file: File) => {
    if (paths.length >= MAX_PHOTOS_PER_MEMORY) {
      setError(`You can add at most ${MAX_PHOTOS_PER_MEMORY} photos per memory.`)
      return
    }
    setError(null)
    setIsUploading(true)
    try {
      const { path } = await uploadMemoryPhoto(userId, memory.id, file)
      const nextPaths = [path, ...paths]
      await updateMemory(userId, memory.id, { photoPaths: nextPaths })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemovePhoto = async (path: string) => {
    setError(null)
    setRemovingPath(path)
    try {
      await deleteMemoryPhotoByPath(path)
      const nextPaths = paths.filter((p) => p !== path)
      await updateMemory(userId, memory.id, { photoPaths: nextPaths })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove photo')
    } finally {
      setRemovingPath(null)
    }
  }

  const handleSetCover = async (path: string) => {
    if (!paths.includes(path) || paths[0] === path) return
    setError(null)
    const nextPaths = [path, ...paths.filter((p) => p !== path)]
    try {
      await updateMemory(userId, memory.id, { photoPaths: nextPaths })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cover photo')
    }
  }

  const handleConfirmDelete = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await deleteMemory(userId, memory.id)
      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory')
      setIsDeleting(false)
    }
  }

  return (
    <SidePanel
      title={memory.title || 'Memory'}
      titleSlot={
        <InlineEditableTitle
          value={title}
          onChange={setTitle}
          placeholder="Untitled memory"
          ariaLabel="Edit memory name"
          disabled={busy}
        />
      }
      subtitle={
        <InlineEditableSubtitle
          value={occurredOn}
          onChange={setOccurredOn}
          placeholder="add a date"
          ariaLabel="Edit memory date"
          inputType="date"
          formatDisplay={formatHumanDate}
          disabled={busy}
        />
      }
      onClose={onClose}
      accent="memory"
      hero={{
        avatarLabel: getInitialsForAvatar(title || memory.title || 'Memory'),
        avatarImageUrl: heroPhotoUrl ?? undefined,
        avatarSlot: (
          <EditableAvatar
            imageUrl={heroPhotoUrl}
            fallbackLabel={getInitialsForAvatar(title || memory.title || 'Memory')}
            onFilePicked={(file) => void handleAvatarPhoto(file)}
            uploading={isUploading}
            disabled={busy}
            ariaLabel={paths.length === 0 ? 'Add cover photo' : 'Add new cover photo'}
          />
        ),
      }}
    >
      <form onSubmit={handleSave} className={clsx('form-stack', styles.editForm)}>
        <section className={styles.journalSection}>
          <InlineEditableField
            label="Journal"
            kind="textarea"
            value={description}
            onChange={setDescription}
            placeholder="Click to add a note about this memory"
            disabled={busy}
          />
        </section>

        <section className={styles.photosSection}>
          <p className={styles.photosLead}>
            <strong className={styles.photosTitle}>Photos</strong>
            <span className={styles.photosCount}>
              {paths.length} / {MAX_PHOTOS_PER_MEMORY} — JPEG or PNG, max 10 MB each
            </span>
            {isUploading ? (
              <span className={styles.uploadingStatus}>Uploading…</span>
            ) : null}
          </p>
          <PhotoGalleryGrid
            paths={paths}
            urls={photoUrls}
            max={MAX_PHOTOS_PER_MEMORY}
            uploading={isUploading}
            removingPath={removingPath}
            disabled={busy}
            onAddPhoto={(file) => void handleAddPhoto(file)}
            onRemovePhoto={(p) => void handleRemovePhoto(p)}
            onSetCover={(p) => void handleSetCover(p)}
          />
        </section>

        <section className={styles.peopleSection}>
          <p className={styles.sectionLabel}>
            <strong>People</strong>
            <span className={styles.sectionHelp}>people included in this memory</span>
          </p>
          <PeoplePicker
            items={people}
            selectedIds={personNodeIds}
            onChange={setPersonNodeIds}
            max={10}
            disabled={busy}
          />
        </section>

        {error ? (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        ) : null}

        <SaveCornerButton visible={hasUnsavedChanges} busy={isSaving} />
      </form>

      <TrashCornerButton
        onConfirm={handleConfirmDelete}
        ariaLabel="Delete memory"
        confirmTitle="Delete memory"
        confirmMessage={
          memory.title
            ? `Permanently delete “${memory.title}” and all attached photos? This cannot be undone.`
            : 'Permanently delete this memory and all attached photos? This cannot be undone.'
        }
        confirmLabel="Delete memory"
        isBusy={isDeleting}
        disabled={busy}
      />
    </SidePanel>
  )
}
