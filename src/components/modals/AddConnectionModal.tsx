import { useEffect, useState } from 'react'
import { createEdge, getNodes, type NodeDoc } from '../../firebase/graph'
import { Modal } from './Modal'

type Props = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export function AddConnectionModal({ userId, onClose, onSuccess }: Props) {
  const [existingNodes, setExistingNodes] = useState<NodeDoc[]>([])
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNodes(userId, 'context')
      .then(setExistingNodes)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load nodes'))
  }, [userId])

  const handleAdd = async () => {
    if (!sourceId || !targetId) {
      return
    }

    if (sourceId === targetId) {
      setError('Source and target node cannot be the same');
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await createEdge(userId, sourceId, targetId, 'context')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection')
    } finally {
      setIsSubmitting(false)
    }
  }

  const nodeList = (
    label: string,
    selectedId: string | null,
    onSelect: (id: string) => void,
  ) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>
        {label}
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          maxHeight: 200,
          overflowY: 'auto',
          backgroundColor: '#fff',
        }}
      >
        {existingNodes.length === 0 ? (
          <li style={{ padding: '0.5rem', color: '#6b7280', fontSize: 13 }}>No nodes yet.</li>
        ) : (
          existingNodes.map((node) => (
            <li
              key={node.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(node.id)
                }
              }}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                fontSize: 13,
                backgroundColor: selectedId === node.id ? '#e0f2fe' : 'transparent',
                transition: 'background-color 0.1s',
              }}
            >
              {node.name}
              <span style={{ color: '#94a3b8', marginLeft: '0.4rem', fontSize: 11 }}>
                {node.type}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )

  return (
    <Modal title="Add Connection" onClose={onClose}>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
        Select a source and target node to create a connection between them.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {nodeList('From', sourceId, setSourceId)}

        <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem', color: '#94a3b8', fontSize: '1.1rem' }}>
          →
        </div>

        {nodeList('To', targetId, setTargetId)}
      </div>

      {/* Preview of selected connection */}
      {(sourceId || targetId) && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            fontSize: '0.8rem',
            color: '#475569',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {sourceId
              ? (existingNodes.find((n) => n.id === sourceId)?.name ?? '…')
              : '—'}
          </span>
          <span style={{ color: '#94a3b8' }}>→</span>
          <span style={{ fontWeight: 600 }}>
            {targetId
              ? (existingNodes.find((n) => n.id === targetId)?.name ?? '…')
              : '—'}
          </span>
        </div>
      )}

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
          type="button"
          disabled={!sourceId || !targetId || isSubmitting}
          className="home-auth-button"
          style={{ marginTop: 0 }}
          onClick={handleAdd}
        >
          {isSubmitting ? 'Adding…' : 'Add connection'}
        </button>
      </div>
    </Modal>
  )
}
