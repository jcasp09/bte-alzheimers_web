import { type SubmitEvent, useState } from 'react'
import { Modal } from './Modal'
import { deleteNodeAndEdges, uploadPersonNodePhoto, upsertNode } from '../../firebase/graph'

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
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEdit = nodeType === 'person' || nodeType === 'place'
  const isPhotoTypeAllowed = (file: File): boolean => file.type === 'image/jpeg' || file.type === 'image/png'

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
          if (!isPhotoTypeAllowed(photoFile)) {
            throw new Error('Only JPEG and PNG photos are supported')
          }
          setIsUploading(true)
          const uploadedPhoto = await uploadPersonNodePhoto(userId, nodeId, photoFile, 'context')
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
        }, 'context')
      } else {
        await upsertNode(userId, nodeId, {
          type: 'place',
          name,
          address,
        }, 'context')
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
      await deleteNodeAndEdges(userId, nodeId, 'context')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
      setIsDeleting(false)
    }
  }

  return (
    <Modal title={nodeName || 'Node'} onClose={onClose}>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: '1.25rem' }}>
        Type: <strong style={{ color: '#374151' }}>{nodeType}</strong>
      </p>

      {canEdit && (
        <form onSubmit={handleSave} className="home-auth-form" style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="home-auth-field">
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="home-auth-field">
                  <span>Relationship</span>
                  <input
                    type="text"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="home-auth-field">
                  <span>Email (optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="home-auth-field">
                  <span>Phone (optional)</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="home-auth-field">
                  <span>{photoPath ? 'Replace Photo (JPEG/PNG)' : 'Add Photo (JPEG/PNG)'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {photoFile && (
                  <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: 12 }}>
                    Selected: {photoFile.name}
                  </p>
                )}
                {!photoFile && photoPath && (
                  <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: 12 }}>
                    A photo is currently attached.
                  </p>
                )}
              </div>
            </>
          )}

          {nodeType === 'place' && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="home-auth-field">
                <span>Address</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={isSaving || isDeleting || isUploading}
              className="home-auth-button"
              style={{ marginTop: 0 }}
            >
              {isUploading ? 'Uploading photo…' : isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="home-auth-error" style={{ marginBottom: '0.75rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={isDeleting || isSaving || isUploading}
          onClick={handleDelete}
          style={{
            padding: '0.45rem 0.9rem',
            borderRadius: '0.5rem',
            border: '1px solid #fca5a5',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            cursor: isDeleting || isSaving || isUploading ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: isDeleting || isSaving || isUploading ? 0.6 : 1,
          }}
        >
          {isDeleting ? 'Deleting…' : 'Delete node'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="home-auth-toggle-button"
          style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
