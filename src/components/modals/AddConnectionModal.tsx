import { useState } from 'react'
import type { Connection } from '@xyflow/react'
import type { PickableNode } from '../../types/graph'
import { EDGE_SIDES, sourceHandleForSide, targetHandleForSide, type EdgeSide } from '../../graph/edgeHandles'
import { Modal } from '../ui/Modal'

type Props = {
  pickableNodes: PickableNode[]
  onClose: () => void
  /** Adds the edge to local graph state; Firestore write is deferred by the parent. */
  onQueueConnection: (
    connection: Connection,
    opts?: { label?: string },
  ) => string | null
}

export function AddConnectionModal({ pickableNodes, onClose, onQueueConnection }: Props) {
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [sourceSide, setSourceSide] = useState<EdgeSide>('bottom')
  const [targetSide, setTargetSide] = useState<EdgeSide>('top')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionLabel, setConnectionLabel] = useState('')

  const connectableNodes = pickableNodes

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
      onQueueConnection(
        {
          source: sourceId,
          target: targetId,
          sourceHandle: sourceHandleForSide(sourceSide),
          targetHandle: targetHandleForSide(targetSide),
        },
        { label: connectionLabel.trim() || undefined },
      )
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
        {connectableNodes.length === 0 ? (
          <li style={{ padding: '0.5rem', color: '#6b7280', fontSize: 13 }}>
            No people or places to connect yet.
          </li>
        ) : (
          connectableNodes.map((node) => (
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

  const sidePicker = (
    label: string,
    value: EdgeSide,
    onChange: (side: EdgeSide) => void,
  ) => (
    <div style={{ marginBottom: '0.75rem' }}>
      <p style={{ margin: '0 0 0.35rem', fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {EDGE_SIDES.map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => onChange(side)}
            style={{
              padding: '0.3rem 0.55rem',
              borderRadius: '0.35rem',
              border: `1px solid ${value === side ? '#0284c7' : '#e5e7eb'}`,
              background: value === side ? '#e0f2fe' : '#fff',
              color: value === side ? '#0369a1' : '#475569',
              fontSize: 12,
              fontWeight: value === side ? 600 : 500,
              cursor: 'pointer',
            }}
          >
            {side.charAt(0).toUpperCase() + side.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Modal title="Add Connection" onClose={onClose}>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
        Select a source and target node, then which side of each node the link uses (same as dragging between handles on the graph).
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {nodeList('From', sourceId, setSourceId)}

        <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem', color: '#94a3b8', fontSize: '1.1rem' }}>
          →
        </div>

        {nodeList('To', targetId, setTargetId)}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem 1rem',
          marginBottom: '1rem',
        }}
      >
        {sidePicker('From side (outgoing)', sourceSide, setSourceSide)}
        {sidePicker('To side (incoming)', targetSide, setTargetSide)}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="home-auth-field">
          <span>Label (optional)</span>
          <input
            type="text"
            value={connectionLabel}
            onChange={(e) => setConnectionLabel(e.target.value)}
            placeholder="Shown on the connection line"
          />
        </label>
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
              ? (connectableNodes.find((n) => n.id === sourceId)?.name ?? '…')
              : '—'}
          </span>
          <span style={{ color: '#94a3b8' }}>→</span>
          <span style={{ fontWeight: 600 }}>
            {targetId
              ? (connectableNodes.find((n) => n.id === targetId)?.name ?? '…')
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
