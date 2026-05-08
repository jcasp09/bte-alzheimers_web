import { useEffect, useRef, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import clsx from 'clsx'
import type { MemoryDoc } from '../firebase/memories'
import {
  MAX_PHOTOS_PER_MEMORY,
  deleteMemory,
  formatOccurredOnDate,
  parseOccurredOn,
  updateMemory,
} from '../firebase/memories'
import { deleteMemoryPhotoByPath, uploadMemoryPhoto } from '../firebase/memoryPhotos'
import type { NodeDoc } from '../types/graph'
import { storage } from '../firebase/storage'
import { MultiEntityPicker, type PickerItem } from '../shared/ui/MultiEntityPicker'
import formStyles from '../shared/styles/formActions.module.css'
import styles from './MemoryEditorCard.module.css'

type MemoryEditorCardProps = {
  uid: string
  memory: MemoryDoc
  people: NodeDoc[]
  onRemoved: (id: string) => void
  onUpdated: (m: MemoryDoc) => void
}

const DEBOUNCE_MS = 500

export function MemoryEditorCard({
  uid,
  memory,
  people,
  onRemoved,
  onUpdated,
}: MemoryEditorCardProps) {
  const [title, setTitle] = useState(memory.title)
  const [description, setDescription] = useState(memory.description)
  const [occurredOn, setOccurredOn] = useState(memory.occurredOn)
  const [personNodeIds, setPersonNodeIds] = useState<string[]>(memory.personNodeIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPath, setRemovingPath] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(memory.title)
    setDescription(memory.description)
    setOccurredOn(memory.occurredOn)
    setPersonNodeIds(memory.personNodeIds)
  }, [
    memory.id,
    memory.title,
    memory.description,
    memory.occurredOn,
    memory.personNodeIds,
  ])

  useEffect(() => {
    let cancelled = false
    const paths = memory.photoPaths ?? []
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
  }, [memory.id, memory.photoPaths])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const peopleItems: PickerItem[] = people.map((p) => ({ id: p.id, name: p.name }))
  const paths = memory.photoPaths ?? []

  const persist = async (scheduledId: string) => {
    if (scheduledId !== memory.id)
      return

    setError(null)
    const patch: Parameters<typeof updateMemory>[2] = {}
    if (title !== memory.title) patch.title = title
    if (description !== memory.description) patch.description = description
    if (occurredOn !== memory.occurredOn) {
      if (!parseOccurredOn(occurredOn)) {
        setError('Use a valid calendar date (YYYY-MM-DD).')
        return
      }
      patch.occurredOn = occurredOn
    }
    const pJson = JSON.stringify([...personNodeIds].sort())
    const p0 = JSON.stringify([...memory.personNodeIds].sort())
    if (pJson !== p0) patch.personNodeIds = personNodeIds

    if (Object.keys(patch).length === 0) return

    setSaving(true)
    try {
      await updateMemory(uid, memory.id, patch)
      onUpdated({
        ...memory,
        ...patch,
        personNodeIds: patch.personNodeIds ?? memory.personNodeIds,
        placeNodeIds: memory.placeNodeIds,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const scheduleSave = () => {
    if (timer.current) clearTimeout(timer.current)
    const scheduledId = memory.id
    timer.current = setTimeout(() => {
      timer.current = null
      void persist(scheduledId)
    }, DEBOUNCE_MS)
  }

  const handlePhotoPick = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    if (paths.length >= MAX_PHOTOS_PER_MEMORY) {
      setError(`You can add at most ${MAX_PHOTOS_PER_MEMORY} photos per memory.`)
      return
    }
    setError(null)
    setUploadingPhoto(true)
    try {
      const { path } = await uploadMemoryPhoto(uid, memory.id, file)
      const nextPaths = [...paths, path]
      await updateMemory(uid, memory.id, { photoPaths: nextPaths })
      onUpdated({ ...memory, photoPaths: nextPaths })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = async (path: string) => {
    setError(null)
    setRemovingPath(path)
    try {
      await deleteMemoryPhotoByPath(path)
      const nextPaths = paths.filter((p) => p !== path)
      await updateMemory(uid, memory.id, { photoPaths: nextPaths })
      onUpdated({ ...memory, photoPaths: nextPaths })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove photo')
    } finally {
      setRemovingPath(null)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this memory permanently?')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteMemory(uid, memory.id)
      onRemoved(memory.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const dateParts = parseOccurredOn(occurredOn)
  const dateInputValue = dateParts ? formatOccurredOnDate(dateParts.y, dateParts.m, dateParts.d) : occurredOn

  return (
    <article className="form-stack">
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={scheduleSave}
          aria-label="Memory name"
        />
      </label>

      <label className="field">
        <span>Date</span>
        <input
          type="date"
          value={dateInputValue}
          onChange={(e) => setOccurredOn(e.target.value)}
          onBlur={scheduleSave}
          aria-label="Memory date"
        />
      </label>

      <label className="field">
        <span>Journal / description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={scheduleSave}
          rows={4}
          aria-label="Memory description"
        />
      </label>

      <section>
        <p className={clsx(formStyles.leadText, styles.photosLead)}>
          <strong className={styles.photosTitle}>Photos</strong>
          <span className={styles.photosCount}>
            {paths.length} / {MAX_PHOTOS_PER_MEMORY} — JPEG or PNG, max 10 MB each
          </span>
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={uploadingPhoto || paths.length >= MAX_PHOTOS_PER_MEMORY}
          onChange={(e) => {
            void handlePhotoPick(e.target.files)
            e.target.value = ''
          }}
        />
        {uploadingPhoto ? (
          <span className={styles.uploadingStatus}>Uploading…</span>
        ) : null}
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
                disabled={removingPath === p}
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
      </section>

      <MultiEntityPicker
        label="People"
        max={10}
        items={peopleItems}
        selectedIds={personNodeIds}
        onChange={(ids) => {
          setPersonNodeIds(ids)
          scheduleSave()
        }}
      />

      {error ? <p className={clsx('text-error', formStyles.errorText)}>{error}</p> : null}

      <div className={styles.footerRow}>
        <button
          type="button"
          className={formStyles.dangerButton}
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting…' : 'Delete memory'}
        </button>

        <div className={styles.savingIndicator}>
          {saving ? <span className={styles.savingLabel}>Saving…</span> : null}
        </div>
      </div>
    </article>
  )
}
