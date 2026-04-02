import { useEffect, useState } from 'react'
import { deleteNodeAndEdges, getNodes, type NodeDoc } from '../../firebase/graph'

type Props = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export function DeleteNodeModal({ userId, onClose, onSuccess }: Props) {
  const [candidates, setCandidates] = useState<NodeDoc[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNodes(userId, 'context')
      .then(setCandidates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load nodes'))
  }, [userId])

  const handleDelete = async () => {
    if (!selectedId) {
      return
    }

    setError(null)
    setIsDeleting(true)

    try {
      await deleteNodeAndEdges(userId, selectedId, 'context')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
      setIsDeleting(false)
    }
  }

  return (
    <div
      style={{
        marginTop: '1rem',
        marginBottom: '1rem',
        padding: '1rem',
        border: '1px solid #fecaca',
        borderRadius: '0.5rem',
        backgroundColor: '#fef2f2',
      }}
    >
      <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Delete a node</p>
      <p style={{ marginBottom: '0.75rem', fontSize: 12, color: '#6b7280' }}>
        This will remove the node and any connections linked to it.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          maxHeight: 220,
          overflowY: 'auto',
          backgroundColor: '#fff',
        }}
      >
        {candidates.length === 0 ? (
          <li style={{ padding: '0.5rem', color: '#6b7280' }}>No nodes to delete.</li>
        ) : (
          candidates.map((node) => (
            <li
              key={node.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(node.id);
                }
              }}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: selectedId === node.id ? '#fee2e2' : 'transparent',
                fontSize: 14
              }}
            >
              {node.name} ({node.type})
            </li>
          ))
        )}
      </ul>

      {error != null && (
        <p className="home-auth-error" style={{ marginTop: '0.5rem' }}>{error}</p>
      )}

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={!selectedId || isDeleting}
          className="home-auth-button"
          style={{ marginTop: 0 }}
          onClick={handleDelete}
        >
          {isDeleting ? 'Deleting…' : 'Confirm delete'}
        </button>
        <button
          type="button"
          className="home-auth-toggle-button"
          style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
