import { type SubmitEvent, useEffect, useState } from 'react'
import clsx from 'clsx'
import { SidePanel } from '../../../shared/ui/SidePanel'
import {
  GRAPH_IDS,
  PHOTO_ACCEPT_ATTR,
  PHOTO_TYPE_LABEL,
  deleteNodeAndEdges,
  isAllowedPhotoType,
  uploadPersonNodePhoto,
  upsertNode,
} from '../../data/graph'
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
  nodeWidth?: number
  nodeHeight?: number
  onClose: () => void
  onSuccess: () => void
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
  nodeWidth,
  nodeHeight,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState(nodeName)
  const [relationship, setRelationship] = useState(nodeRelationship)
  const [email, setEmail] = useState(nodeEmail)
  const [phone, setPhone] = useState(nodePhone)
  const [address, setAddress] = useState(nodeAddress)
  const [photoPath, setPhotoPath] = useState(nodePhotoPath)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const resolvedAvatarUrl = usePhotoUrl(photoPath)
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
      if (nodeType === 'person') {
        let nextPhotoPath = photoPath
        let nextPhotoUpdatedAt: string | undefined

        if (photoFile) {
          if (!isAllowedPhotoType(photoFile)) {
            setError(`Only ${PHOTO_TYPE_LABEL} photos are supported`)
            return
          }

          setIsUploading(true)
          const uploadedPhoto = await uploadPersonNodePhoto(userId, nodeId, photoFile, GRAPH_IDS.context)
          nextPhotoPath = uploadedPhoto.photoPath
          nextPhotoUpdatedAt = uploadedPhoto.photoUpdatedAt
          setPhotoPath(uploadedPhoto.photoPath)
        }

        await upsertNode(userId, nodeId, {
          type: 'person',
          name,
          relationship,
          email,
          phone,
          photoPath: nextPhotoPath || undefined,
          photoUpdatedAt: nextPhotoUpdatedAt ?? undefined,
          width: sizeW,
          height: sizeH,
        }, GRAPH_IDS.context)
      } else {
        await upsertNode(userId, nodeId, {
          type: 'place',
          name,
          address,
          width: sizeW,
          height: sizeH,
        }, GRAPH_IDS.context)
      }

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

  const busy = isSaving || isDeleting || isUploading
  const canDecrease = sizeNodeType ? canDecreaseNodeSize(sizeNodeType, sizeW, sizeH) : false
  const canIncrease = sizeNodeType ? canIncreaseNodeSize(sizeNodeType, sizeW, sizeH) : false

  return (
    <SidePanel
      title={nodeName || 'Node'}
      onClose={onClose}
      accent={
        nodeType === 'person'
          ? 'person'
          : nodeType === 'place'
            ? 'place'
            : nodeType === 'group'
              ? 'group'
              : 'neutral'
      }
      hero={{
        avatarLabel: getInitialsForAvatar(name || nodeName),
        avatarImageUrl: resolvedAvatarUrl ?? undefined,
      }}
    >
      <p className={styles.typeRow}>
        Type: <strong>{nodeType}</strong>
      </p>

      {isGroup && (
        <form onSubmit={handleSaveGroup} className={clsx('form-stack', styles.editForm)}>
          <div className={styles.formRow}>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>
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
          <div className={styles.formFooter}>
            <button type="submit" disabled={busy} className="btn-primary">
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {canEdit && (
        <form onSubmit={handleSave} className={clsx('form-stack', styles.editForm)}>
          <div className={styles.formRow}>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>

          {nodeType === 'person' && (
            <>
              <div className={styles.formRow}>
                <label className="field">
                  <span>Relationship</span>
                  <input
                    type="text"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                  />
                </label>
              </div>
              <div className={styles.formRow}>
                <label className="field">
                  <span>Email (optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
              <div className={styles.formRow}>
                <label className="field">
                  <span>Phone (optional)</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              </div>
              <div className={styles.formRow}>
                <label className="field">
                  <span>{photoPath ? `Replace Photo (${PHOTO_TYPE_LABEL})` : `Add Photo (${PHOTO_TYPE_LABEL})`}</span>
                  <input
                    type="file"
                    accept={PHOTO_ACCEPT_ATTR}
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {photoFile && (
                  <p className={styles.photoHint}>
                    Selected: {photoFile.name}
                  </p>
                )}
                {!photoFile && photoPath && (
                  <p className={styles.photoHint}>
                    A photo is currently attached.
                  </p>
                )}
              </div>
            </>
          )}

          {nodeType === 'place' && (
            <div className={styles.formRow}>
              <label className="field">
                <span>Address</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
            </div>
          )}

          {sizeNodeType && (
            <div className={styles.sizeBox}>
              <p className={styles.sizeBoxTitle}>Node size</p>
              <p className={styles.sizeBoxStatus}>
                Each step changes width and height by 10%. Current:{' '}
                <strong>{sizeW} × {sizeH} px</strong>
              </p>
              <div className={styles.sizeButtonRow}>
                <button
                  type="button"
                  className={styles.sizeStepButton}
                  disabled={!canDecrease || isSaving || isUploading}
                  onClick={() => {
                    const next = stepNodeDimensions(sizeNodeType, sizeW, sizeH, -1)
                    setSizeW(next.width)
                    setSizeH(next.height)
                  }}
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.sizeStepButton}
                  disabled={!canIncrease || isSaving || isUploading}
                  onClick={() => {
                    const next = stepNodeDimensions(sizeNodeType, sizeW, sizeH, 1)
                    setSizeW(next.width)
                    setSizeH(next.height)
                  }}
                >
                  +
                </button>
                {defaultDims ? (
                  <button
                    type="button"
                    className={styles.sizeResetButton}
                    disabled={sizeIsAtDefault || isSaving || isUploading}
                    onClick={() => {
                      setSizeW(defaultDims.width)
                      setSizeH(defaultDims.height)
                    }}
                  >
                    Default size
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <div className={styles.formFooter}>
            <button type="submit" disabled={busy} className="btn-primary">
              {isUploading ? 'Uploading photo…' : isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
      )}

      <div className={formStyles.actionsLeftAligned}>
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className={formStyles.dangerButton}
        >
          {isDeleting ? 'Deleting…' : 'Delete node'}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">
          Close
        </button>
      </div>
    </SidePanel>
  )
}
