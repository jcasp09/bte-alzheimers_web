import { useEffect, useRef, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import clsx from 'clsx'
import type { MomentDoc } from '../firebase/moments'
import {
  MAX_PHOTOS_PER_MOMENT,
  deleteMoment,
  formatOccurredOnDate,
  parseOccurredOn,
  updateMoment,
} from '../firebase/moments'
import { deleteMomentPhotoByPath, uploadMomentPhoto } from '../firebase/momentPhotos'
import type { NodeDoc } from '../types/graph'
import { storage } from '../services/storage'
import { MultiEntityPicker, type PickerItem } from './MultiEntityPicker'
import modalStyles from './ui/Modal.module.css'

type MomentEditorCardProps = {
  uid: string
  moment: MomentDoc
  people: NodeDoc[]
  onRemoved: (id: string) => void
  onUpdated: (m: MomentDoc) => void
}

const DEBOUNCE_MS = 500

export function MomentEditorCard({
  uid,
  moment,
  people,
  onRemoved,
  onUpdated,
}: MomentEditorCardProps) {
  const [title, setTitle] = useState(moment.title)
  const [description, setDescription] = useState(moment.description)
  const [occurredOn, setOccurredOn] = useState(moment.occurredOn)
  const [personNodeIds, setPersonNodeIds] = useState<string[]>(moment.personNodeIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPath, setRemovingPath] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const momentIdRef = useRef(moment.id)
  momentIdRef.current = moment.id

  useEffect(() => {
    setTitle(moment.title)
    setDescription(moment.description)
    setOccurredOn(moment.occurredOn)
    setPersonNodeIds(moment.personNodeIds)
  }, [
    moment.id,
    moment.title,
    moment.description,
    moment.occurredOn,
    moment.personNodeIds,
    moment.photoPaths,
  ])

  useEffect(() => {
    let cancelled = false
    const paths = moment.photoPaths ?? []
    void (async () => {
      const next: Record<string, string> = {}
      for (const p of paths) {
        try {
          next[p] = await getDownloadURL(ref(storage, p))
        } catch {
          /* missing file */
        }
      }
      if (!cancelled) setPhotoUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [moment.id, moment.photoPaths])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const peopleItems: PickerItem[] = people.map((p) => ({ id: p.id, name: p.name }))
  const paths = moment.photoPaths ?? []

  const persist = async () => {
    if (momentIdRef.current !== moment.id) return
    setError(null)
    const patch: Parameters<typeof updateMoment>[2] = {}
    if (title !== moment.title) patch.title = title
    if (description !== moment.description) patch.description = description
    if (occurredOn !== moment.occurredOn) {
      if (!parseOccurredOn(occurredOn)) {
        setError('Use a valid calendar date (YYYY-MM-DD).')
        return
      }
      patch.occurredOn = occurredOn
    }
    const pJson = JSON.stringify([...personNodeIds].sort())
    const p0 = JSON.stringify([...moment.personNodeIds].sort())
    if (pJson !== p0) patch.personNodeIds = personNodeIds

    if (Object.keys(patch).length === 0) return

    setSaving(true)
    try {
      await updateMoment(uid, moment.id, patch)
      onUpdated({
        ...moment,
        ...patch,
        personNodeIds: patch.personNodeIds ?? moment.personNodeIds,
        placeNodeIds: moment.placeNodeIds,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const scheduleSave = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void persist()
    }, DEBOUNCE_MS)
  }

  const handlePhotoPick = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    if (paths.length >= MAX_PHOTOS_PER_MOMENT) {
      setError(`You can add at most ${MAX_PHOTOS_PER_MOMENT} photos per moment.`)
      return
    }
    setError(null)
    setUploadingPhoto(true)
    try {
      const { path } = await uploadMomentPhoto(uid, moment.id, file)
      const nextPaths = [...paths, path]
      await updateMoment(uid, moment.id, { photoPaths: nextPaths })
      onUpdated({ ...moment, photoPaths: nextPaths })
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
      await deleteMomentPhotoByPath(path)
      const nextPaths = paths.filter((p) => p !== path)
      await updateMoment(uid, moment.id, { photoPaths: nextPaths })
      onUpdated({ ...moment, photoPaths: nextPaths })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove photo')
    } finally {
      setRemovingPath(null)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this moment permanently?')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteMoment(uid, moment.id)
      onRemoved(moment.id)
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
          aria-label="Moment name"
        />
      </label>

      <label className="field">
        <span>Date</span>
        <input
          type="date"
          value={dateInputValue}
          onChange={(e) => setOccurredOn(e.target.value)}
          onBlur={scheduleSave}
          aria-label="Moment date"
        />
      </label>

      <label className="field">
        <span>Journal / description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={scheduleSave}
          rows={4}
          aria-label="Moment description"
        />
      </label>

      <section>
        <p className={modalStyles.leadText} style={{ marginBottom: '0.5rem' }}>
          <strong style={{ color: 'var(--color-text)' }}>Photos</strong>
          <span style={{ marginLeft: 8 }}>
            {paths.length} / {MAX_PHOTOS_PER_MOMENT} — JPEG or PNG, max 10 MB each
          </span>
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={uploadingPhoto || paths.length >= MAX_PHOTOS_PER_MOMENT}
          onChange={(e) => {
            void handlePhotoPick(e.target.files)
            e.target.value = ''
          }}
        />
        {uploadingPhoto ? (
          <span style={{ marginLeft: '0.5rem', fontSize: 12, color: 'var(--color-text-muted)' }}>Uploading…</span>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.6rem' }}>
          {paths.map((p) => (
            <div
              key={p}
              style={{
                position: 'relative',
                width: 128,
                height: 128,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-raised)',
              }}
            >
              {photoUrls[p] ? (
                <img src={photoUrls[p]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 11, padding: 6, display: 'block', color: 'var(--color-text-muted)' }}>
                  Loading…
                </span>
              )}
              <button
                type="button"
                disabled={removingPath === p}
                onClick={() => void handleRemovePhoto(p)}
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: '1px solid var(--color-border)',
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  lineHeight: 1,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, color 0.15s ease, transform 0.08s ease',
                }}
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

      {error ? <p className={clsx('text-error', modalStyles.errorText)}>{error}</p> : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={modalStyles.dangerButton}
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting…' : 'Delete moment'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {saving ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Saving…</span> : null}
        </div>
      </div>
    </article>
  )
}
