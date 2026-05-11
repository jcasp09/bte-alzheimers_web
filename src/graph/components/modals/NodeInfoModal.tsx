import { type SubmitEvent, useEffect, useMemo, useState } from 'react'
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
import { clearNodePhoto, deleteNodeAndEdges, saveNodeDimensions, upsertNode } from '../../data/nodes'
import { PHOTO_ACCEPT_ATTR, PHOTO_TYPE_LABEL, deleteNodePhotoByPath, isAllowedPhotoType, uploadNodePhoto } from '../../data/photos'
import { GRAPH_IDS } from '../../model/types'
import {
  GROUP_DIMENSION_BOUNDS,
  GROUP_NODE_DEFAULT_SIZE,
  canDecreaseNodeSize,
  canIncreaseNodeSize,
  clampGroupDimension,
  defaultNodeSize,
  safeNodeDimensions,
  stepNodeDimensions,
} from '../../model/dimensions'
import formStyles from '../../../shared/styles/formActions.module.css'
import styles from './NodeInfoModal.module.css'
import { getInitialsForAvatar } from '../../../shared/util/initials'
import { usePhotoUrl } from '../../../shared/hooks/usePhotoUrl'

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
  onClose: () => void
  onSuccess: () => void
  /** Called immediately after a size step so the canvas can reflect the change. */
  onSizeChanged?: (width: number, height: number) => void
  connectedPeople?: LinkedAvatarItem[]
  connectedPlaces?: LinkedAvatarItem[]
  connectedMemories?: LinkedAvatarItem[]
  onFocusConnectedNode?: (nodeId: string) => void
  onFocusConnectedMemory?: (memoryId: string) => void
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
  onClose,
  onSuccess,
  onSizeChanged,
  connectedPeople,
  connectedPlaces,
  connectedMemories,
  onFocusConnectedNode,
  onFocusConnectedMemory,
}: Props) {
  const [name, setName] = useState(nodeName)
  const [relationship, setRelationship] = useState(nodeRelationship)
  const [email, setEmail] = useState(nodeEmail)
  const [phone, setPhone] = useState(nodePhone)
  const [address, setAddress] = useState(nodeAddress)
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

  const [groupW, setGroupW] = useState(() =>
    clampGroupDimension(nodeWidth, GROUP_NODE_DEFAULT_SIZE.width),
  )
  const [groupH, setGroupH] = useState(() =>
    clampGroupDimension(nodeHeight, GROUP_NODE_DEFAULT_SIZE.height),
  )

  const canEdit = nodeType === 'person' || nodeType === 'place'
  const isGroup = nodeType === 'group'
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

  useEffect(() => {
    if (isGroup) {
      setGroupW(clampGroupDimension(nodeWidth, GROUP_NODE_DEFAULT_SIZE.width))
      setGroupH(clampGroupDimension(nodeHeight, GROUP_NODE_DEFAULT_SIZE.height))
    }
  }, [nodeId, isGroup, nodeWidth, nodeHeight])

  const handleAvatarFilePicked = (file: File) => {
    if (!isAllowedPhotoType(file)) {
      setError(`Only ${PHOTO_TYPE_LABEL} photos are supported`)
      return
    }
    setError(null)
    setPendingPhotoRemoval(false)
    setPhotoFile(file)
  }

  const handleSaveGroup = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!isGroup) return

    setError(null)
    setIsSaving(true)
    try {
      await upsertNode(
        userId,
        nodeId,
        {
          type: 'group',
          name,
          width: clampGroupDimension(groupW, GROUP_NODE_DEFAULT_SIZE.width),
          height: clampGroupDimension(groupH, GROUP_NODE_DEFAULT_SIZE.height),
        },
        GRAPH_IDS.context,
      )
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!canEdit) return

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

      if (nodeType === 'person') {
        if (pendingPhotoRemoval && !photoFile) {
          await clearNodePhoto(userId, nodeId, GRAPH_IDS.context)
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
        }, GRAPH_IDS.context)
      } else {
        if (pendingPhotoRemoval && !photoFile) {
          await clearNodePhoto(userId, nodeId, GRAPH_IDS.context)
        }
        await upsertNode(userId, nodeId, {
          type: 'place',
          name,
          address,
          photoPath: nextPhotoPath,
          photoUpdatedAt: nextPhotoUpdatedAt,
          width: sizeW,
          height: sizeH,
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

  const initialGroupW = useMemo(
    () => clampGroupDimension(nodeWidth, GROUP_NODE_DEFAULT_SIZE.width),
    [nodeWidth],
  )
  const initialGroupH = useMemo(
    () => clampGroupDimension(nodeHeight, GROUP_NODE_DEFAULT_SIZE.height),
    [nodeHeight],
  )

  const hasUnsavedChanges = (() => {
    if (nodeType === 'person') {
      return (
        name !== nodeName ||
        relationship !== nodeRelationship ||
        email !== nodeEmail ||
        phone !== nodePhone ||
        photoFile != null ||
        pendingPhotoRemoval
      )
    }
    if (nodeType === 'place') {
      return (
        name !== nodeName ||
        address !== nodeAddress ||
        photoFile != null ||
        pendingPhotoRemoval
      )
    }
    if (nodeType === 'group') {
      return (
        name !== nodeName ||
        groupW !== initialGroupW ||
        groupH !== initialGroupH
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
        : nodeType === 'group'
          ? 'group'
          : 'neutral'

  const connectedSections = (nodeType === 'person' || nodeType === 'place') ? (
    <>
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
          placeholder={isGroup ? 'Untitled group' : 'Untitled'}
          ariaLabel="Edit name"
          disabled={busy}
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
      {isGroup && (
        <form onSubmit={handleSaveGroup} className={clsx('form-stack', styles.editForm)}>
          <div className={styles.dimensionsGrid}>
            <label className="field">
              <span>Width (px)</span>
              <input
                type="number"
                min={GROUP_DIMENSION_BOUNDS.min}
                max={GROUP_DIMENSION_BOUNDS.max}
                step={10}
                required
                value={groupW}
                onChange={(e) => setGroupW(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Height (px)</span>
              <input
                type="number"
                min={GROUP_DIMENSION_BOUNDS.min}
                max={GROUP_DIMENSION_BOUNDS.max}
                step={10}
                required
                value={groupH}
                onChange={(e) => setGroupH(Number(e.target.value))}
              />
            </label>
          </div>
          <p className={styles.helpText}>
            {`Frame size is clamped between ${GROUP_DIMENSION_BOUNDS.min} and ${GROUP_DIMENSION_BOUNDS.max} px on save.`}
          </p>
          <div className={styles.flexSpacer} />
          <SaveCornerButton visible={hasUnsavedChanges} busy={isSaving} />
        </form>
      )}

      {nodeType === 'person' && (
        <form onSubmit={handleSave} className={clsx('form-stack', styles.editForm)}>
          <div className={styles.fieldList}>
            <InlineEditableField
              label="Relationship"
              value={relationship}
              onChange={setRelationship}
              disabled={busy}
            />
            <InlineEditableField
              label="Email"
              kind="email"
              value={email}
              onChange={setEmail}
              disabled={busy}
            />
            <InlineEditableField
              label="Phone"
              kind="tel"
              value={phone}
              onChange={setPhone}
              disabled={busy}
            />
          </div>

          {connectedSections}

          {error ? (
            <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
          ) : null}

          <div className={styles.flexSpacer} />
          <SaveCornerButton
            visible={hasUnsavedChanges}
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
            visible={hasUnsavedChanges}
            busy={isSaving || isUploading}
            busyLabel={isUploading ? 'Uploading…' : 'Saving…'}
          />
        </form>
      )}

      {isGroup && error ? (
        <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
      ) : null}

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
