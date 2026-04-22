import { type SubmitEvent, useState } from 'react'
import { createEdge, createNode, getNodes, uploadPersonNodePhoto, upsertNode, type NodeDoc, type NodeType } from '../../firebase/graph'
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE } from '../../graph/edgeHandles'

const VALID_NODE_TYPES = new Set<NodeType>(['person', 'place'])
import { Modal } from './Modal'

type Props = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export function AddNodePanel({ userId, onClose, onSuccess }: Props) {
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [nodeType, setNodeType] = useState<NodeType>('person')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [linkToNodeId, setLinkToNodeId] = useState<string | null>(null)
  const [showLinkList, setShowLinkList] = useState(false)
  const [existingNodes, setExistingNodes] = useState<NodeDoc[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPhotoTypeAllowed = (file: File): boolean => file.type === 'image/jpeg' || file.type === 'image/png'

  const openLinkList = async () => {
    setShowLinkList(true)
    try {
      const nodes = await getNodes(userId)
      // Ensure that only nodes with valid information are displayed
      setExistingNodes(nodes.filter((n) => VALID_NODE_TYPES.has(n.type) && n.name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes')
    }
  }

  const handleTypeChange = (type: NodeType) => {
    setNodeType(type)
    setName('')
    setRelationship('')
    setEmail('')
    setPhone('')
    setAddress('')
    setPhotoFile(null)
    setLinkToNodeId(null)
    setShowLinkList(false)
    setError(null)
  }

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const data =
        nodeType === 'person'
          ? { type: 'person' as const, name, relationship, email, phone }
          : { type: 'place' as const, name, address }
      const newNodeId = await createNode(userId, data)

      if (nodeType === 'person' && photoFile) {
        if (!isPhotoTypeAllowed(photoFile)) {
          throw new Error('Only JPEG and PNG photos are supported')
        }

        setIsUploading(true)
        const photo = await uploadPersonNodePhoto(userId, newNodeId, photoFile, 'context')
        await upsertNode(userId, newNodeId, {
          type: 'person',
          name,
          relationship,
          email,
          phone,
          photoPath: photo.photoPath,
          photoUpdatedAt: photo.photoUpdatedAt,
        }, 'context')
      }

      if (linkToNodeId) {
        await createEdge(userId, newNodeId, linkToNodeId, 'context', {
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

  return (
    <Modal title="Add Node" onClose={onClose}>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          padding: '0.25rem',
          background: '#f1f5f9',
          borderRadius: '0.5rem',
        }}
      >
        {(['person', 'place'] as NodeType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            style={{
              flex: 1,
              padding: '0.4rem 0',
              border: 'none',
              borderRadius: '0.35rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              background: nodeType === type ? '#fff' : 'transparent',
              color: nodeType === type ? '#1e293b' : '#64748b',
              boxShadow: nodeType === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {type === 'person' ? 'Person' : 'Place'}
          </button>
        ))}
      </div>

      {/* ── Form fields ── */}
      <form onSubmit={handleSubmit} className="home-auth-form">
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
                <span>Add Photo (JPEG/PNG)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
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

        {/* ── Link to existing node ── */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.875rem' }}>
            Link to existing node (optional)
          </p>
          <button
            type="button"
            onClick={openLinkList}
            className="home-auth-toggle-button"
            style={{
              border: '1px solid #e5e7eb',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
            }}
          >
            {linkToNodeId
              ? (existingNodes.find((n) => n.id === linkToNodeId)?.name ?? 'Change link')
              : 'Choose node to link to'}
          </button>
          {showLinkList && (
            <ul
              style={{
                marginTop: '0.5rem',
                padding: 0,
                listStyle: 'none',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                backgroundColor: '#fff',
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {existingNodes.length === 0 ? (
                <li style={{ padding: '0.5rem', color: '#6b7280', fontSize: 13 }}>
                  No nodes yet. Add one first.
                </li>
              ) : (
                existingNodes.map((node) => (
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
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: 13,
                    }}
                  >
                    {node.name} ({node.type})
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {error != null && (
          <p className="home-auth-error" style={{ marginBottom: '0.75rem' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="home-auth-toggle-button"
            style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="home-auth-button"
            style={{ marginTop: 0 }}
          >
            {isUploading ? 'Uploading photo…' : isSubmitting ? 'Adding…' : 'Add node'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
