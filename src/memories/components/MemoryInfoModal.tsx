import { type SubmitEvent, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { getDownloadURL, ref } from 'firebase/storage'
import {
  MAX_PHOTOS_PER_MEMORY,
  type MemoryDoc,
  deleteMemory,
  formatOccurredOnDate,
  parseOccurredOn,
  updateMemory,
} from '../data/memories'
import { deleteMemoryPhotoByPath, uploadMemoryPhoto } from '../data/photos'
import { storage } from '../../firebase/storage'
import { SidePanel } from '../../shared/ui/SidePanel'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { MultiEntityPicker, type PickerItem } from '../../shared/ui/MultiEntityPicker'
import { getInitialsForAvatar } from '../../shared/util/initials'
import { usePhotoUrl } from '../../shared/hooks/usePhotoUrl'
import formStyles from '../../shared/styles/formActions.module.css'
import styles from './MemoryInfoModal.module.css'

type Props = {
  userId: string
  memory: MemoryDoc
  people: PickerItem[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const paths = useMemo(() => memory.photoPaths ?? [], [memory.photoPaths])

  // Hydrate local fields when the active memory changes (e.g. user clicks a different node).
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

  // Resolve thumbnail URLs for the photo tiles. The hero photo is fetched
  // separately via usePhotoUrl so it benefits from the shared cache.
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

  const dateParts = useMemo(() => parseOccurredOn(occurredOn), [occurredOn])
  const dateInputValue = dateParts
    ? formatOccurredOnDate(dateParts.y, dateParts.m, dateParts.d)
    : occurredOn

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

  const handlePhotoPick = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
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

  const handleConfirmDelete = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await deleteMemory(userId, memory.id)
      setConfirmingDelete(false)
      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory')
      setIsDeleting(false)
    }
  }

  return (
    <>
      <SidePanel
        title={memory.title || 'Memory'}
        onClose={onClose}
        accent="memory"
        hero={{
          avatarLabel: getInitialsForAvatar(title || memory.title || 'Memory'),
          avatarImageUrl: heroPhotoUrl ?? undefined,
        }}
      >
        <form onSubmit={handleSave} className={clsx('form-stack', styles.editForm)}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              aria-label="Memory name"
            />
          </label>

          <label className="field">
            <span>Date</span>
            <input
              type="date"
              required
              value={dateInputValue}
              onChange={(e) => setOccurredOn(e.target.value)}
              disabled={busy}
              aria-label="Memory date"
            />
          </label>

          <label className="field">
            <span>Journal / description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={busy}
              aria-label="Memory description"
            />
          </label>

          <section className={styles.photosSection}>
            <p className={styles.photosLead}>
              <strong className={styles.photosTitle}>Photos</strong>
              <span className={styles.photosCount}>
                {paths.length} / {MAX_PHOTOS_PER_MEMORY} — JPEG or PNG, max 10 MB each
              </span>
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={isUploading || isDeleting || paths.length >= MAX_PHOTOS_PER_MEMORY}
              onChange={(e) => {
                void handlePhotoPick(e.target.files)
                e.target.value = ''
              }}
            />
            {isUploading ? (
              <span className={styles.uploadingStatus}>Uploading…</span>
            ) : null}
            {paths.length > 0 && (
              <div className={styles.photoGrid}>
                {paths.map((p) => (
                  <div key={p} className={styles.photoTile}>
                    {photoUrls[p] ? (
                      <img src={photoUrls[p]} alt="" className={styles.photoImage} />
                    ) : (
                      <span className={styles.photoLoading}>Loading…</span>
                    )}
                    <button
                      type="button"
                      disabled={removingPath === p || busy}
                      onClick={() => void handleRemovePhoto(p)}
                      className={styles.photoRemoveButton}
                      aria-label="Remove photo"
                      title="Remove photo"
                    >
                      {removingPath === p ? '…' : '✕'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <MultiEntityPicker
            label="People at this memory"
            max={10}
            items={people}
            selectedIds={personNodeIds}
            onChange={setPersonNodeIds}
            disabled={busy}
          />

          {error ? (
            <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
          ) : null}

          <div className={styles.formFooter}>
            <button
              type="submit"
              disabled={busy || !hasUnsavedChanges}
              className="btn-primary"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <div className={formStyles.actionsLeftAligned}>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
            className={formStyles.dangerButton}
          >
            {isDeleting ? 'Deleting…' : 'Delete memory'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>
            Close
          </button>
        </div>
      </SidePanel>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete memory"
          message={
            memory.title
              ? `Permanently delete “${memory.title}” and all attached photos? This cannot be undone.`
              : 'Permanently delete this memory and all attached photos? This cannot be undone.'
          }
          confirmLabel="Delete memory"
          confirmVariant="danger"
          isConfirming={isDeleting}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
}
