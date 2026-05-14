import { type SubmitEvent, useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { createEdge } from '../../data/edges'
import { createNode, upsertNode } from '../../data/nodes'
import { PHOTO_ACCEPT_ATTR, PHOTO_TYPE_LABEL, isAllowedPhotoType, uploadNodePhoto } from '../../data/photos'
import { GRAPH_IDS } from '../../model/types'
import type { NodeType } from '../../model/types'
import {
  inferRingFromRelationship,
  OUTERMOST_PEOPLE_RING,
  OUTERMOST_PLACE_RING,
  type RingTier,
} from '../../model/rings'
import { RingPicker } from '../RingPicker'
import { CENTER_SOURCE_HANDLE_ID, CENTER_TARGET_HANDLE_ID } from '../NodeEdgeHandles'
import { SidePanel } from '../../../shared/ui/SidePanel'
import { InlineEditableTitle } from '../../../shared/ui/InlineEditableTitle'
import { InlineEditableSubtitle } from '../../../shared/ui/InlineEditableSubtitle'
import { InlineEditableField } from '../../../shared/ui/InlineEditableField'
import { EditableAvatar } from '../../../shared/ui/EditableAvatar'
import { SaveCornerButton } from '../../../shared/ui/SaveCornerButton'
import { LinkedAvatarRow, type LinkedAvatarItem } from '../../../shared/ui/LinkedAvatarRow'
import { usePublishCanvasLinkMode } from '../../../shared/hooks/usePublishCanvasLinkMode'
import { getInitialsForAvatar } from '../../../shared/util/initials'
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
import styles from './AddNodeModal.module.css'

export type AddPanelLinkable = {
  id: string
  type: NodeType
  name: string
  photoPath?: string
}

export type AddPanelCanvasLinkMode = {
  eligibleTypes: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
} | null

type Props = {
  userId: string
  pickableNodes: AddPanelLinkable[]
  initialType?: NodeType
  position?: { x: number; y: number }
  onClose: () => void
  onSuccess: () => void
  onSetCanvasLinkMode: (mode: AddPanelCanvasLinkMode) => void
}

const ELIGIBLE_TYPES: ReadonlySet<string> = new Set(['person', 'place', 'self'])

export function AddNodePanel({
  userId,
  pickableNodes,
  initialType = 'person',
  position,
  onClose,
  onSuccess,
  onSetCanvasLinkMode,
}: Props) {
  const nodeType = initialType
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ringTier, setRingTier] = useState<RingTier | null>(null)
  const [ringTouched, setRingTouched] = useState(false)

  const inferredRingTier = useMemo<RingTier | null>(() => {
    if (nodeType === 'place') return OUTERMOST_PLACE_RING
    if (nodeType !== 'person') return null
    return inferRingFromRelationship(relationship) ?? OUTERMOST_PEOPLE_RING
  }, [nodeType, relationship])

  useEffect(() => {
    if (!ringTouched) {
      setRingTier(inferredRingTier)
    }
  }, [inferredRingTier, ringTouched])

  const stagedPhotoUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  )
  useEffect(() => {
    return () => {
      if (stagedPhotoUrl) URL.revokeObjectURL(stagedPhotoUrl)
    }
  }, [stagedPhotoUrl])

  const handleLinkToggle = useCallback(
    (id: string) =>
      setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  )
  usePublishCanvasLinkMode(onSetCanvasLinkMode, ELIGIBLE_TYPES, linkedIds, handleLinkToggle)

  const handleAvatarFile = (file: File) => {
    if (!isAllowedPhotoType(file)) {
      setError(`Only ${PHOTO_TYPE_LABEL} photos are supported`)
      return
    }
    setError(null)
    setPhotoFile(file)
  }

  const nameValidator = nodeType === 'person' ? personNameValidator : placeNameValidator
  const formValid = nodeType === 'person'
    ? allValid([
        [nameValidator, name],
        [relationshipValidator, relationship],
        [emailValidator, email],
        [phoneValidator, phone],
      ])
    : allValid([
        [nameValidator, name],
        [addressValidator, address],
      ])

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!formValid) {
      setError(nameValidator.validate(name) ?? 'Please fix the highlighted fields.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const persistedRingTier = ringTouched && ringTier != null && ringTier !== inferredRingTier
        ? ringTier
        : undefined

      const data = nodeType === 'person'
        ? { type: 'person' as const, name, relationship, email, phone, position, ringTier: persistedRingTier }
        : { type: 'place' as const, name, address, position, ringTier: persistedRingTier }
      const newNodeId = await createNode(userId, data)

      if (photoFile) {
        setIsUploading(true)
        const photo = await uploadNodePhoto(userId, newNodeId, photoFile, GRAPH_IDS.context)
        if (nodeType === 'person') {
          await upsertNode(userId, newNodeId, {
            type: 'person',
            name,
            relationship,
            email,
            phone,
            photoPath: photo.photoPath,
            photoUpdatedAt: photo.photoUpdatedAt,
            ringTier: persistedRingTier,
          }, GRAPH_IDS.context)
        } else {
          await upsertNode(userId, newNodeId, {
            type: 'place',
            name,
            address,
            photoPath: photo.photoPath,
            photoUpdatedAt: photo.photoUpdatedAt,
            ringTier: persistedRingTier,
          }, GRAPH_IDS.context)
        }
      }

      for (const linkId of linkedIds) {
        await createEdge(userId, newNodeId, linkId, GRAPH_IDS.context, {
          sourceHandle: CENTER_SOURCE_HANDLE_ID,
          targetHandle: CENTER_TARGET_HANDLE_ID,
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

  const linkedNodes = linkedIds
    .map((id) => pickableNodes.find((n) => n.id === id))
    .filter((n): n is AddPanelLinkable => n != null)
  const linkedPeople: LinkedAvatarItem[] = linkedNodes
    .filter((n) => n.type === 'person')
    .map((n) => ({ id: n.id, name: n.name, photoPath: n.photoPath }))
  const linkedPlaces: LinkedAvatarItem[] = linkedNodes
    .filter((n) => n.type === 'place')
    .map((n) => ({ id: n.id, name: n.name, photoPath: n.photoPath }))

  const accent = nodeType === 'person' ? 'person' : 'place'
  const heroImageUrl = stagedPhotoUrl ?? undefined
  const fallbackInitials = getInitialsForAvatar(name) || (nodeType === 'person' ? '?' : '?')
  const namePlaceholder = nodeType === 'person' ? 'Add a person' : 'Add a place'
  const busy = isSubmitting || isUploading

  return (
    <SidePanel
      title={name || namePlaceholder}
      titleSlot={
        <InlineEditableTitle
          value={name}
          onChange={setName}
          placeholder={namePlaceholder}
          ariaLabel="Edit name"
          disabled={busy}
          validator={nameValidator}
        />
      }
      subtitle={
        nodeType === 'place' ? (
          <InlineEditableSubtitle
            value={address}
            onChange={setAddress}
            placeholder="add an address"
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
        avatarImageUrl: heroImageUrl,
        avatarSlot: (
          <EditableAvatar
            imageUrl={heroImageUrl}
            fallbackLabel={fallbackInitials}
            onFilePicked={handleAvatarFile}
            onRemovePhoto={photoFile ? () => setPhotoFile(null) : undefined}
            removeAriaLabel="Discard new photo"
            accept={PHOTO_ACCEPT_ATTR}
            uploading={isUploading}
            disabled={busy}
            alwaysShowOverlay
            ariaLabel="Add photo"
          />
        ),
      }}
    >
      <form onSubmit={handleSubmit} className={clsx('form-stack', styles.editForm)}>
        {nodeType === 'person' && (
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
        )}

        {nodeType === 'person' && (
          <RingPicker
            value={ringTier}
            predicted={inferredRingTier}
            onChange={(next) => {
              setRingTouched(true)
              setRingTier(next)
            }}
            showAutoIndicator={!ringTouched}
            disabled={busy}
            scope="people"
          />
        )}

        <section className={styles.networkSection} aria-label="Network">
          <p className={styles.networkHeading}>Network</p>
          <p className={styles.connectionsHelp}>
            Click nodes on the canvas to link.
          </p>

          <div className={styles.linksSection}>
            <p className={styles.sectionLabel}>
              <strong>Connected people</strong>
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
              <strong>Connected places</strong>
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

        {error ? (
          <p className={clsx('text-error', formStyles.errorText)}>{error}</p>
        ) : null}

        <SaveCornerButton
          visible={formValid}
          busy={isSubmitting || isUploading}
          busyLabel={isUploading ? 'Uploading…' : 'Saving…'}
          label="Add"
          ariaLabel={`Add ${nodeType}`}
        />
      </form>
    </SidePanel>
  )
}
