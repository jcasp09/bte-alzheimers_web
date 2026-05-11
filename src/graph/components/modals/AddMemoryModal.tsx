import { type SubmitEvent, useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  MAX_PEOPLE_PER_MEMORY,
  MAX_PHOTOS_PER_MEMORY,
  MAX_PLACES_PER_MEMORY,
  createMemory,
  parseOccurredOn,
  updateMemory,
} from '../../../memories/data/memories'
import { uploadMemoryPhoto } from '../../../memories/data/photos'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { InlineEditableTitle } from '../../../shared/ui/InlineEditableTitle'
import { InlineEditableSubtitle } from '../../../shared/ui/InlineEditableSubtitle'
import { InlineEditableField } from '../../../shared/ui/InlineEditableField'
import { EditableAvatar } from '../../../shared/ui/EditableAvatar'
import { SaveCornerButton } from '../../../shared/ui/SaveCornerButton'
import { LinkedAvatarRow, type LinkedAvatarItem } from '../../../shared/ui/LinkedAvatarRow'
import { PhotoGalleryGrid } from '../../../shared/ui/PhotoGalleryGrid'
import { usePublishCanvasLinkMode } from '../../../shared/hooks/usePublishCanvasLinkMode'
import { getInitialsForAvatar } from '../../../shared/util/initials'
import {
  allValid,
  firstError,
  memoryDateValidator,
  memoryDescriptionValidator,
  memoryTitleValidator,
} from '../../../shared/validation/fieldValidators'
import formStyles from '../../../shared/styles/formActions.module.css'
import styles from './AddMemoryModal.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function formatHumanDate(occurredOn: string): string {
  const parts = parseOccurredOn(occurredOn)
  if (!parts) return occurredOn
  return `${MONTHS[parts.m - 1]} ${parts.d}, ${parts.y}`
}

import type { NodeType } from '../../model/types'

export type AddMemoryLinkable = {
  id: string
  type: NodeType
  name: string
  photoPath?: string
}

export type AddMemoryCanvasLinkMode = {
  eligibleTypes: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
} | null

type Props = {
  userId: string
  pickableNodes: AddMemoryLinkable[]
  onClose: () => void
  onCreated: () => Promise<void> | void
  onSetCanvasLinkMode: (mode: AddMemoryCanvasLinkMode) => void
}

const ELIGIBLE_TYPES: ReadonlySet<string> = new Set(['person', 'place'])
const STAGED_KEY = (i: number) => `staged-${i}`

export function AddMemoryModal({
  userId,
  pickableNodes,
  onClose,
  onCreated,
  onSetCanvasLinkMode,
}: Props) {
  const [title, setTitle] = useState('')
  const [occurredOn, setOccurredOn] = useState('')
  const [description, setDescription] = useState('')
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stagedUrls = useMemo(() => {
    const map: Record<string, string> = {}
    stagedFiles.forEach((f, i) => {
      map[STAGED_KEY(i)] = URL.createObjectURL(f)
    })
    return map
  }, [stagedFiles])
  useEffect(() => {
    return () => {
      Object.values(stagedUrls).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [stagedUrls])

  const stagedPaths = useMemo(() => stagedFiles.map((_, i) => STAGED_KEY(i)), [stagedFiles])

  const handleLinkToggle = useCallback(
    (id: string) =>
      setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  )
  usePublishCanvasLinkMode(onSetCanvasLinkMode, ELIGIBLE_TYPES, linkedIds, handleLinkToggle)

  const linkedNodes = linkedIds
    .map((id) => pickableNodes.find((n) => n.id === id))
    .filter((n): n is AddMemoryLinkable => n != null)
  const linkedPeople: LinkedAvatarItem[] = linkedNodes
    .filter((n) => n.type === 'person')
    .slice(0, MAX_PEOPLE_PER_MEMORY)
    .map((n) => ({ id: n.id, name: n.name, photoPath: n.photoPath }))
  const linkedPlaces: LinkedAvatarItem[] = linkedNodes
    .filter((n) => n.type === 'place')
    .slice(0, MAX_PLACES_PER_MEMORY)
    .map((n) => ({ id: n.id, name: n.name, photoPath: n.photoPath }))

  const heroPhotoUrl = stagedPaths.length > 0 ? stagedUrls[stagedPaths[0]] : undefined
  const fallbackInitials = getInitialsForAvatar(title) || '?'
  const formValid = allValid([
    [memoryTitleValidator, title],
    [memoryDateValidator, occurredOn],
    [memoryDescriptionValidator, description],
  ])
  const busy = isSubmitting || isUploading

  const handleAvatarPhoto = (file: File) => {
    if (stagedFiles.length >= MAX_PHOTOS_PER_MEMORY) {
      setError(`You can add at most ${MAX_PHOTOS_PER_MEMORY} photos per memory.`)
      return
    }
    setError(null)
    // Avatar upload prepends (becomes new cover).
    setStagedFiles((prev) => [file, ...prev])
  }

  const handleAddPhoto = (file: File) => {
    if (stagedFiles.length >= MAX_PHOTOS_PER_MEMORY) {
      setError(`You can add at most ${MAX_PHOTOS_PER_MEMORY} photos per memory.`)
      return
    }
    setError(null)
    setStagedFiles((prev) => [...prev, file])
  }

  const handleRemovePhoto = (path: string) => {
    const idx = stagedPaths.indexOf(path)
    if (idx < 0) return
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSetCover = (path: string) => {
    const idx = stagedPaths.indexOf(path)
    if (idx <= 0) return
    setStagedFiles((prev) => {
      const next = [...prev]
      const [picked] = next.splice(idx, 1)
      next.unshift(picked)
      return next
    })
  }

  const personNodeIds = linkedNodes.filter((n) => n.type === 'person').map((n) => n.id)
  const placeNodeIds = linkedNodes.filter((n) => n.type === 'place').map((n) => n.id)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setError(null)
    const validationError = firstError([
      [memoryTitleValidator, title],
      [memoryDateValidator, occurredOn],
      [memoryDescriptionValidator, description],
    ])
    if (validationError != null) {
      setError(validationError)
      return
    }
    const trimmedTitle = title.trim()

    setIsSubmitting(true)
    try {
      const memoryId = await createMemory(userId, {
        title: trimmedTitle,
        description: description.trim(),
        occurredOn,
        personNodeIds,
        placeNodeIds,
      })

      if (stagedFiles.length > 0) {
        setIsUploading(true)
        const paths: string[] = []
        for (const f of stagedFiles) {
          const { path } = await uploadMemoryPhoto(userId, memoryId, f)
          paths.push(path)
        }
        await updateMemory(userId, memoryId, { photoPaths: paths })
      }

      await onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memory')
    } finally {
      setIsUploading(false)
      setIsSubmitting(false)
    }
  }

  return (
    <SidePanel
      title={title || 'Add a memory'}
      titleSlot={
        <InlineEditableTitle
          value={title}
          onChange={setTitle}
          placeholder="Add a memory"
          ariaLabel="Edit memory name"
          disabled={busy}
          validator={memoryTitleValidator}
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
          validator={memoryDateValidator}
        />
      }
      onClose={onClose}
      accent="memory"
      hero={{
        avatarLabel: fallbackInitials,
        avatarImageUrl: heroPhotoUrl,
        avatarSlot: (
          <EditableAvatar
            imageUrl={heroPhotoUrl}
            fallbackLabel={fallbackInitials}
            onFilePicked={handleAvatarPhoto}
            uploading={isUploading}
            disabled={busy}
            alwaysShowOverlay
            ariaLabel="Add cover photo"
          />
        ),
      }}
    >
      <form onSubmit={handleSubmit} className={clsx('form-stack', styles.editForm)}>
        <section className={styles.journalSection}>
          <InlineEditableField
            label="Journal"
            kind="textarea"
            value={description}
            onChange={setDescription}
            placeholder="Click to add a note about this memory"
            disabled={busy}
            validator={memoryDescriptionValidator}
          />
        </section>

        <section className={styles.photosSection}>
          <p className={styles.photosLead}>
            <strong className={styles.photosTitle}>Photos</strong>
            <span className={styles.photosCount}>
              {stagedFiles.length} / {MAX_PHOTOS_PER_MEMORY} — JPEG or PNG, max 10 MB each
            </span>
            {isUploading ? (
              <span className={styles.uploadingStatus}>Uploading…</span>
            ) : null}
          </p>
          <PhotoGalleryGrid
            paths={stagedPaths}
            urls={stagedUrls}
            max={MAX_PHOTOS_PER_MEMORY}
            uploading={false}
            disabled={busy}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
            onSetCover={handleSetCover}
          />
        </section>

        <p className={styles.connectionsHelp}>
          Click people or places on the canvas to include them in this memory.
        </p>

        <section className={styles.linkSection}>
          <p className={styles.sectionLabel}>
            <strong>People</strong>
            <span className={styles.sectionHelp}>
              {linkedPeople.length} / {MAX_PEOPLE_PER_MEMORY}
            </span>
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
            <p className={styles.linksEmpty}>None included yet.</p>
          )}
        </section>

        <section className={styles.linkSection}>
          <p className={styles.sectionLabel}>
            <strong>Places</strong>
            <span className={styles.sectionHelp}>
              {linkedPlaces.length} / {MAX_PLACES_PER_MEMORY}
            </span>
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
            <p className={styles.linksEmpty}>None included yet.</p>
          )}
        </section>

        {error ? (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        ) : null}

        <SaveCornerButton
          visible={formValid}
          busy={busy}
          busyLabel={isUploading ? 'Uploading…' : 'Saving…'}
          label="Add"
          ariaLabel="Add memory"
        />
      </form>
    </SidePanel>
  )
}
