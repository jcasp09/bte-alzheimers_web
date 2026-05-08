import { type SubmitEvent, useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  GRAPH_IDS,
  PHOTO_ACCEPT_ATTR,
  PHOTO_TYPE_LABEL,
  createEdge,
  createNode,
  isAllowedPhotoType,
  uploadPersonNodePhoto,
  upsertNode,
} from '../../services/graph'
import type { NodeType, PickableNode } from '../../types/graph'
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE } from '../../graph/edgeHandles'
import { SidePanel } from '../../shared/ui/SidePanel'
import formStyles from '../../shared/styles/formActions.module.css'
import styles from './AddNodeModal.module.css'
import { getInitialsForAvatar } from '../../shared/util/initials'

type Props = {
  userId: string
  pickableNodes: PickableNode[]
  initialType?: NodeType
  position?: { x: number; y: number }
  onClose: () => void
  onSuccess: () => void
}

export function AddNodePanel({ userId, pickableNodes, initialType = 'person', position, onClose, onSuccess }: Props) {
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [linkToNodeId, setLinkToNodeId] = useState<string | null>(null)
  const [showLinkList, setShowLinkList] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nodeType = initialType

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(url)
    return () => { URL.revokeObjectURL(url) }
  }, [photoFile])

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (nodeType === 'person' && photoFile && !isAllowedPhotoType(photoFile)) {
        setError(`Only ${PHOTO_TYPE_LABEL} photos are supported`);
        return;
      }

      const data = nodeType === 'person'
        ? { type: 'person' as const, name, relationship, email, phone, position }
        : { type: 'place' as const, name, address, position }
      const newNodeId = await createNode(userId, data)

      if (nodeType === 'person' && photoFile) {
        setIsUploading(true)
        const photo = await uploadPersonNodePhoto(userId, newNodeId, photoFile, GRAPH_IDS.context)
        await upsertNode(userId, newNodeId, {
          type: 'person',
          name,
          relationship,
          email,
          phone,
          photoPath: photo.photoPath,
          photoUpdatedAt: photo.photoUpdatedAt,
        }, GRAPH_IDS.context)
      }

      if (linkToNodeId) {
        await createEdge(userId, newNodeId, linkToNodeId, GRAPH_IDS.context, {
          sourceHandle: DEFAULT_SOURCE_HANDLE,
          targetHandle: DEFAULT_TARGET_HANDLE,
        })
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add node')
    } finally {
      setIsUploading(false)
      setIsSubmitting(false)
    }
  }

  const panelTitle = nodeType === 'person' ? 'Add a person' : 'Add a place'
  const panelAccent = nodeType === 'person' ? 'person' : 'place'

  return (
    <SidePanel
      title={panelTitle}
      onClose={onClose}
      accent={panelAccent}
      hero={{
        avatarLabel: getInitialsForAvatar(name),
        avatarImageUrl: photoPreviewUrl ?? undefined,
      }}
    >
      {/* Form fields */}
      <form onSubmit={handleSubmit} className="form-stack">
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
                <span>{`Add Photo (${PHOTO_TYPE_LABEL})`}</span>
                <input
                  type="file"
                  accept={PHOTO_ACCEPT_ATTR}
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
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

        {/* Link to existing node */}
        <div className={styles.linkSection}>
          <p className={styles.linkSectionLabel}>
            Link to existing node (optional)
          </p>
          <button
            type="button"
            onClick={() => setShowLinkList((prev) => !prev)}
            className={clsx('btn-ghost', styles.linkPickerToggle)}
          >
            {linkToNodeId
              ? (pickableNodes.find((n) => n.id === linkToNodeId)?.name ?? 'Change link')
              : 'Choose node to link to'}
          </button>
          {showLinkList && (
            <ul className={styles.linkPickerList}>
              {pickableNodes.length === 0 ? (
                <li className={styles.linkPickerEmpty}>
                  No nodes yet. Add one first.
                </li>
              ) : (
                pickableNodes.map((node) => (
                  <li
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setLinkToNodeId(node.id); setShowLinkList(false) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setLinkToNodeId(node.id)
                        setShowLinkList(false)
                      }
                    }}
                    className={styles.linkPickerItem}
                  >
                    {node.name} ({node.type})
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {error != null && (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        )}

        <div className={formStyles.actions}>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || isUploading} className="btn-primary">
            {isUploading ? 'Uploading photo…' : isSubmitting ? 'Adding…' : 'Add node'}
          </button>
        </div>
      </form>
    </SidePanel>
  )
}
