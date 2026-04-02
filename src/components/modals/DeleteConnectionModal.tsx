import { useEffect, useState } from 'react'
import { deleteEdge, getEdges, getNodes, type EdgeDoc, type NodeDoc } from '../../firebase/graph'

type Props = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export function DeleteConnectionModal({ userId, onClose, onSuccess }: Props) {
  const [nodes, setNodes] = useState<NodeDoc[]>([])
  const [edges, setEdges] = useState<EdgeDoc[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getNodes(userId, 'context'), getEdges(userId, 'context')])
      .then(([n, e]) => { setNodes(n); setEdges(e) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load connections'))
  }, [userId])

  const handleDelete = async () => {
    if (!selectedId) {
      return
    }

    setError(null)
    setIsDeleting(true)

    try {
      await deleteEdge(userId, selectedId, 'context')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection')
      setIsDeleting(false)
    }
  }

  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id

  return (
    <div
      style={{
        marginTop: '1rem',
        marginBottom: '1rem',
        padding: '1rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        backgroundColor: '#fef2f2',
      }}
    >
      <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Delete a connection</p>
      <p style={{ marginBottom: '0.75rem', fontSize: 12, color: '#6b7280' }}>
        Choose a connection between two nodes to remove it.
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
        {edges.length === 0 ? (
          <li style={{ padding: '0.5rem', color: '#6b7280' }}>No connections to delete.</li>
        ) : (
          edges.map((edge) => (
            <li
              key={edge.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(edge.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(edge.id);
                }
              }}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: selectedId === edge.id ? '#fee2e2' : 'transparent',
                fontSize: 14,
              }}
            >
              {nodeName(edge.sourceNodeId)} → {nodeName(edge.targetNodeId)}
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
          {isDeleting ? 'Deleting…' : 'Delete connection'}
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
