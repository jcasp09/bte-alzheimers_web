import { type SubmitEvent, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { InlineEditableField } from '../../../shared/ui/InlineEditableField'
import { InlineEditableTitle } from '../../../shared/ui/InlineEditableTitle'
import { EditableAvatar } from '../../../shared/ui/EditableAvatar'
import { TrashCornerButton } from '../../../shared/ui/TrashCornerButton'
import { LinkedAvatarRow, type LinkedAvatarItem } from '../../../shared/ui/LinkedAvatarRow'
import { SaveCornerButton } from '../../../shared/ui/SaveCornerButton'
import { InlineEditableSubtitle } from '../../../shared/ui/InlineEditableSubtitle'
import { AvatarCornerButton } from '../../../shared/ui/AvatarCornerButton'
import { MinusIcon, PlusIcon, EqualsIcon } from '../../../shared/ui/icons'
import { clearNodePhoto, clearNodeRingTier, deleteNodeAndEdges, saveNodeDimensions, upsertNode } from '../../data/nodes'
import { PHOTO_ACCEPT_ATTR, PHOTO_TYPE_LABEL, deleteNodePhotoByPath, isAllowedPhotoType, uploadNodePhoto } from '../../data/photos'
import { GRAPH_IDS } from '../../model/types'
import { inferRingFromRelationship, type RingTier } from '../../model/rings'
import { RingPicker } from '../RingPicker'
import {
  canDecreaseNodeSize,
  canIncreaseNodeSize,
  defaultNodeSize,
  safeNodeDimensions,
  stepNodeDimensions,
} from '../../model/dimensions'
import {
  addressValidator,
  allValid,
  emailValidator,
  personNameValidator,
  phoneValidator,
  placeNameValidator,
  relationshipValidator,
} from '../../../shared/validation/fieldValidators'
import formStyles from '../../../shared/styles/formActions.module.css'
import styles from './NodeInfoModal.module.css'
import { getInitialsForAvatar } from '../../../shared/util/initials'
import { usePhotoUrl } from '../../../shared/hooks/usePhotoUrl'

export type UpcomingTaskSummary = {
  id: string
  title: string
  startAt?: string
}

function formatTaskTimeShort(value?: string): string {
  if (typeof value !== 'string' || value.length === 0) return 'Time not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time not set'
  const now = new Date()
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Today · ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type Props = {
  userId: string
  nodeId: string
  nodeName: string
  nodeType: string
  nodeRelationship: string
  nodeEmail: string
  nodePhone: string
  nodeAddress: string
  nodePhotoPath: string
  nodePhotoUpdatedAt?: string
  nodeWidth?: number
  nodeHeight?: number
  nodeRingTier?: RingTier | null
  inferredRingTier?: RingTier | null
  onClose: () => void
  onSuccess: () => void
  onSizeChanged?: (width: number, height: number) => void
  connectedPeople?: LinkedAvatarItem[]
  connectedPlaces?: LinkedAvatarItem[]
  connectedMemories?: LinkedAvatarItem[]
  upcomingTasks?: UpcomingTaskSummary[]
  onFocusConnectedNode?: (nodeId: string) => void
  onFocusConnectedMemory?: (memoryId: string) => void
  onFocusTask?: (taskId: string) => void
}

export function NodeInfoModal({
  userId,
  nodeId,
  nodeName,
  nodeType,
  nodeRelationship,
  nodeEmail,
  nodePhone,
  nodeAddress,
  nodePhotoPath,
  nodePhotoUpdatedAt,
  nodeWidth,
  nodeHeight,
  nodeRingTier,
  inferredRingTier,
  onClose,
  onSuccess,
  onSizeChanged,
  connectedPeople,
  connectedPlaces,
  connectedMemories,
  upcomingTasks,
  onFocusConnectedNode,
  onFocusConnectedMemory,
  onFocusTask,
}: Props) {
  const [name, setName] = useState(nodeName)
  const [relationship, setRelationship] = useState(nodeRelationship)
  const [email, setEmail] = useState(nodeEmail)
  const [phone, setPhone] = useState(nodePhone)
  const [address, setAddress] = useState(nodeAddress)
  const [ringTier, setRingTier] = useState<RingTier | null>(nodeRingTier ?? null)
  const initialPredictedRing = useRef<RingTier | null>(inferredRingTier ?? null)
  const livePredictedRing = useMemo<RingTier | null>(() => {
    if (nodeType !== 'person') return inferredRingTier ?? null
    const fromKeyword = inferRingFromRelationship(relationship)
    return fromKeyword ?? inferredRingTier ?? null
  }, [nodeType, relationship, inferredRingTier])
  const showRingAutoIndicator =
    ringTier == null && livePredictedRing !== initialPredictedRing.current
  const [photoPath, setPhotoPath] = useState(nodePhotoPath)
  const [photoUpdatedAt, setPhotoUpdatedAt] = useState<string | undefined>(nodePhotoUpdatedAt)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [pendingPhotoRemoval, setPendingPhotoRemoval] = useState(false)
  const resolvedAvatarUrl = usePhotoUrl(photoPath, photoUpdatedAt)

  const stagedPhotoUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  )
  useEffect(() => {
    return () => {
      if (stagedPhotoUrl) URL.revokeObjectURL(stagedPhotoUrl)
    }
  }, [stagedPhotoUrl])

  const [sizeW, setSizeW] = useState(() =>
    (nodeType === 'person' || nodeType === 'place')
      ? safeNodeDimensions(nodeType, nodeWidth, nodeHeight).width
      : 0,
  )
  const [sizeH, setSizeH] = useState(() =>
    (nodeType === 'person' || nodeType === 'place')
      ? safeNodeDimensions(nodeType, nodeWidth, nodeHeight).height
      : 0,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEdit = nodeType === 'person' || nodeType === 'place'

  const nameValidator =
    nodeType === 'person'
      ? personNameValidator
      : nodeType === 'place'
        ? placeNameValidator
        : null

  const formValid = (() => {
    if (nodeType === 'person') {
      return allValid([
        [personNameValidator, name],
        [relationshipValidator, relationship],
        [emailValidator, email],
        [phoneValidator, phone],
      ])
    }
    if (nodeType === 'place') {
      return allValid([
        [placeNameValidator, name],
        [addressValidator, address],
      ])
    }
    return true
  })()
  const sizeNodeType = nodeType === 'person' || nodeType === 'place' ? nodeType : null
  const defaultDims = sizeNodeType ? defaultNodeSize(sizeNodeType) : null
  const sizeIsAtDefault =
    defaultDims !== null && sizeW === defaultDims.width && sizeH === defaultDims.height
  const supportsPhoto = nodeType === 'person' || nodeType === 'place'

  useEffect(() => {
    if (sizeNodeType) {
      const s = safeNodeDimensions(sizeNodeType, nodeWidth, nodeHeight)
      setSizeW(s.width)
      setSizeH(s.height)
    }
  }, [nodeId, sizeNodeType, nodeWidth, nodeHeight])

  const handleAvatarFilePicked = (file: File) => {
    if (!isAllowedPhotoType(file)) {
      setError(`Only ${PHOTO_TYPE_LABEL} photos are supported`)
      return
    }
    setError(null)
    setPendingPhotoRemoval(false)
    setPhotoFile(file)
  }

  const initialRingTier: RingTier | null = nodeRingTier ?? null

  const handleSave = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!canEdit) return
    if (!formValid) {
      const primary = nameValidator?.validate(name) ?? null
      setError(primary ?? 'Please fix the highlighted fields and try again.')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      let nextPhotoPath: string | undefined = photoPath || undefined
      let nextPhotoUpdatedAt: string | undefined = photoUpdatedAt
      let storageToCleanup: string | null = null

      if (photoFile) {
        setIsUploading(true)
        const uploaded = await uploadNodePhoto(userId, nodeId, photoFile, GRAPH_IDS.context)
        nextPhotoPath = uploaded.photoPath
        nextPhotoUpdatedAt = uploaded.photoUpdatedAt
      } else if (pendingPhotoRemoval && photoPath) {
        storageToCleanup = photoPath
        nextPhotoPath = undefined
        nextPhotoUpdatedAt = undefined
      }

      const persistedRingTier: RingTier | undefined =
        ringTier != null && ringTier !== livePredictedRing ? ringTier : undefined
      const revertingToAuto = persistedRingTier == null && initialRingTier != null

      if (nodeType === 'person') {
        if (pendingPhotoRemoval && !photoFile) {
          await clearNodePhoto(userId, nodeId, GRAPH_IDS.context)
        }
        if (revertingToAuto) {
          await clearNodeRingTier(userId, nodeId, GRAPH_IDS.context)
        }
        await upsertNode(userId, nodeId, {
          type: 'person',
          name,
          relationship,
          email,
          phone,
          photoPath: nextPhotoPath,
          photoUpdatedAt: nextPhotoUpdatedAt,
          width: sizeW,
          height: sizeH,
          ringTier: persistedRingTier,
        }, GRAPH_IDS.context)
      } else {
        if (pendingPhotoRemoval && !photoFile) {
          await clearNodePhoto(userId, nodeId, GRAPH_IDS.context)
        }
        if (revertingToAuto) {
          await clearNodeRingTier(userId, nodeId, GRAPH_IDS.context)
        }
        await upsertNode(userId, nodeId, {
          type: 'place',
          name,
          address,
          photoPath: nextPhotoPath,
          photoUpdatedAt: nextPhotoUpdatedAt,
          width: sizeW,
          height: sizeH,
          ringTier: persistedRingTier,
        }, GRAPH_IDS.context)
      }

      if (storageToCleanup) {
        try {
          await deleteNodePhotoByPath(storageToCleanup)
        } catch (storageErr) {
          console.warn('Failed to delete node photo from storage', storageErr)
        }
      }

      setPhotoPath(nextPhotoPath ?? '')
      setPhotoUpdatedAt(nextPhotoUpdatedAt)
      setPhotoFile(null)
      setPendingPhotoRemoval(false)

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save node')
    } finally {
      setIsUploading(false)
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)

    try {
      await deleteNodeAndEdges(userId, nodeId, GRAPH_IDS.context)
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
      setIsDeleting(false)
    }
  }

  const handleRemovePhoto = () => {
    if (!supportsPhoto) return
    setError(null)
    if (photoFile) {
      setPhotoFile(null)
      return
    }
    if (photoPath) {
      setPendingPhotoRemoval(true)
    }
  }

  const busy = isSaving || isDeleting || isUploading
  const canDecrease = sizeNodeType ? canDecreaseNodeSize(sizeNodeType, sizeW, sizeH) : false
  const canIncrease = sizeNodeType ? canIncreaseNodeSize(sizeNodeType, sizeW, sizeH) : false

  const heroImageUrl = supportsPhoto
    ? (stagedPhotoUrl ?? (pendingPhotoRemoval ? undefined : (resolvedAvatarUrl ?? undefined)))
    : undefined
  const fallbackInitials = getInitialsForAvatar(name || nodeName)

  const hasUnsavedChanges = (() => {
    if (nodeType === 'person') {
      return (
        name !== nodeName ||
        relationship !== nodeRelationship ||
        email !== nodeEmail ||
        phone !== nodePhone ||
        ringTier !== initialRingTier ||
        photoFile != null ||
        pendingPhotoRemoval
      )
    }
    if (nodeType === 'place') {
      return (
        name !== nodeName ||
        address !== nodeAddress ||
        ringTier !== initialRingTier ||
        photoFile != null ||
        pendingPhotoRemoval
      )
    }
    return false
  })()

  const sizeControlsDisabled = isSaving || isUploading

  const commitSize = (width: number, height: number) => {
    setSizeW(width)
    setSizeH(height)
    onSizeChanged?.(width, height)
    void saveNodeDimensions(userId, nodeId, width, height, GRAPH_IDS.context).catch((err) => {
      console.warn('Failed to persist node size', err)
    })
  }

  const hasRemovablePhoto =
    supportsPhoto && (photoFile != null || (photoPath !== '' && !pendingPhotoRemoval))

  const avatarSlot =
    supportsPhoto ? (
      <EditableAvatar
        imageUrl={heroImageUrl}
        fallbackLabel={fallbackInitials}
        onFilePicked={handleAvatarFilePicked}
        onRemovePhoto={hasRemovablePhoto ? handleRemovePhoto : undefined}
        removeAriaLabel={photoFile ? 'Discard new photo' : 'Remove photo'}
        accept={PHOTO_ACCEPT_ATTR}
        uploading={isUploading}
        disabled={busy}
        ariaLabel="Change photo"
        cornerLeft={
          sizeNodeType ? (
            <AvatarCornerButton
              icon={<MinusIcon size={14} />}
              ariaLabel="Decrease node size"
              disabled={!canDecrease || sizeControlsDisabled}
              onClick={() => {
                const next = stepNodeDimensions(sizeNodeType, sizeW, sizeH, -1)
                commitSize(next.width, next.height)
              }}
            />
          ) : undefined
        }
        cornerRight={
          sizeNodeType ? (
            <AvatarCornerButton
              icon={<PlusIcon size={14} />}
              ariaLabel="Increase node size"
              disabled={!canIncrease || sizeControlsDisabled}
              onClick={() => {
                const next = stepNodeDimensions(sizeNodeType, sizeW, sizeH, 1)
                commitSize(next.width, next.height)
              }}
            />
          ) : undefined
        }
        cornerMiddle={
          sizeNodeType && defaultDims && !sizeIsAtDefault ? (
            <AvatarCornerButton
              icon={<EqualsIcon size={14} />}
              ariaLabel="Reset node size"
              variant="reset"
              disabled={sizeControlsDisabled}
              onClick={() => {
                commitSize(defaultDims.width, defaultDims.height)
              }}
            />
          ) : undefined
        }
      />
    ) : undefined

  const accent =
    nodeType === 'person'
      ? 'person'
      : nodeType === 'place'
        ? 'place'
        : 'neutral'

  const connectedSections = (nodeType === 'person' || nodeType === 'place') ? (
    <>
      {upcomingTasks && upcomingTasks.length > 0 ? (
        <section className={styles.connectedSection}>
          <p className={styles.connectedLabel}>
            <strong>Upcoming</strong>
          </p>
          <div className={styles.upcomingList}>
            {upcomingTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.upcomingRow}
                onClick={() => onFocusTask?.(t.id)}
                disabled={busy}
                aria-label={`Open task: ${t.title || 'Untitled task'}`}
              >
                <span className={styles.upcomingTitle}>
                  {t.title || 'Untitled task'}
                </span>
                <span className={styles.upcomingTime}>
                  {formatTaskTimeShort(t.startAt)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {connectedPeople && connectedPeople.length > 0 ? (
        <section className={styles.connectedSection}>
          <p className={styles.connectedLabel}>
            <strong>Connected people</strong>
          </p>
          <LinkedAvatarRow
            items={connectedPeople}
            mode="focus"
            onItemClick={(id) => onFocusConnectedNode?.(id)}
            disabled={busy}
          />
        </section>
      ) : null}
      {connectedPlaces && connectedPlaces.length > 0 ? (
        <section className={styles.connectedSection}>
          <p className={styles.connectedLabel}>
            <strong>Connected places</strong>
          </p>
          <LinkedAvatarRow
            items={connectedPlaces}
            mode="focus"
            onItemClick={(id) => onFocusConnectedNode?.(id)}
            disabled={busy}
          />
        </section>
      ) : null}
      {connectedMemories && connectedMemories.length > 0 ? (
        <section className={styles.connectedSection}>
          <p className={styles.connectedLabel}>
            <strong>Connected memories</strong>
          </p>
          <LinkedAvatarRow
            items={connectedMemories}
            mode="focus"
            onItemClick={(id) => onFocusConnectedMemory?.(id)}
            disabled={busy}
          />
        </section>
      ) : null}
    </>
  ) : null

  return (
    <SidePanel
      title={name || nodeName || 'Node'}
      titleSlot={
        <InlineEditableTitle
          value={name}
          onChange={setName}
          placeholder="Untitled"
          ariaLabel="Edit name"
          disabled={busy}
          validator={nameValidator ?? undefined}
        />
      }
      subtitle={
        nodeType === 'place' ? (
          <InlineEditableSubtitle
            value={address}
            onChange={setAddress}
            placeholder="Add an address"
            ariaLabel="Edit address"
            disabled={busy}
            validator={addressValidator}
          />
        ) : undefined
      }
      onClose={onClose}
      accent={accent}
      hero={{
        avatarLabel: fallbackInitials,
        avatarImageUrl: supportsPhoto ? heroImageUrl : undefined,
        avatarSlot,
      }}
    >
      {nodeType === 'person' && (
        <form onSubmit={handleSave} className={clsx('form-stack', styles.editForm)}>
          <div className={styles.fieldList}>
            <InlineEditableField
              label="Relationship"
              value={relationship}
              onChange={setRelationship}
              disabled={busy}
              validator={relationshipValidator}
            />
            <InlineEditableField
              label="Email"
              kind="email"
              value={email}
              onChange={setEmail}
              disabled={busy}
              validator={emailValidator}
            />
            <InlineEditableField
              label="Phone"
              kind="tel"
              value={phone}
              onChange={setPhone}
              disabled={busy}
              validator={phoneValidator}
            />
          </div>

          <RingPicker
            value={ringTier}
            predicted={livePredictedRing}
            onChange={setRingTier}
            showAutoIndicator={showRingAutoIndicator}
            disabled={busy}
            scope="people"
          />

          {connectedSections}

          {error ? (
            <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
          ) : null}

          <div className={styles.flexSpacer} />
          <SaveCornerButton
            visible={hasUnsavedChanges && formValid}
            busy={isSaving || isUploading}
            busyLabel={isUploading ? 'Uploading…' : 'Saving…'}
          />
        </form>
      )}

      {nodeType === 'place' && (
        <form onSubmit={handleSave} className={clsx('form-stack', styles.editForm)}>
          {connectedSections}

          {error ? (
            <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
          ) : null}

          <div className={styles.flexSpacer} />
          <SaveCornerButton
            visible={hasUnsavedChanges && formValid}
            busy={isSaving || isUploading}
            busyLabel={isUploading ? 'Uploading…' : 'Saving…'}
          />
        </form>
      )}

      <TrashCornerButton
        onConfirm={handleDelete}
        ariaLabel={`Delete ${nodeType}`}
        confirmTitle={`Delete ${nodeType}`}
        confirmMessage={`Permanently delete this ${nodeType}? This cannot be undone.`}
        confirmLabel={`Delete ${nodeType}`}
        isBusy={isDeleting}
        disabled={busy}
      />
    </SidePanel>
  )
}
