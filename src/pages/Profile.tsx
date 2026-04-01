import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  createEdge,
  createNode,
  deleteNodeAndEdges,
  deleteEdge,
  getEdges,
  getNodes,
  type EdgeDoc,
  type NodeDoc,
  type NodeType,
} from '../firebase/graph'
import {
  connectGoogleCalendar,
  isGoogleCalendarConnected,
  syncGoogleCalendarTasks,
} from '../firebase/calendar'

type AddNodeStep = 'type' | 'form'

function Profile() {
  const { user } = useAuth()
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [step, setStep] = useState<AddNodeStep>('type')
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
  const [error, setError] = useState<string | null>(null)
  const [isCalendarConnected, setIsCalendarConnected] = useState(false)
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false)
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false)
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null)
  const [deleteNodeOpen, setDeleteNodeOpen] = useState(false)
  const [deleteCandidates, setDeleteCandidates] = useState<NodeDoc[]>([])
  const [nodeIdToDelete, setNodeIdToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteEdgeOpen, setDeleteEdgeOpen] = useState(false)
  const [edgeCandidates, setEdgeCandidates] = useState<EdgeDoc[]>([])
  const [edgeIdToDelete, setEdgeIdToDelete] = useState<string | null>(null)
  const [addConnectionOpen, setAddConnectionOpen] = useState(false)
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null)
  const [connectionTargetId, setConnectionTargetId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.uid) {
      setIsCalendarConnected(isGoogleCalendarConnected(user.uid))
    } else {
      setIsCalendarConnected(false)
    }
  }, [user?.uid])

  const openAddNode = () => {
    setAddNodeOpen(true)
    setStep('type')
    setNodeType('person')
    setName('')
    setRelationship('')
    setEmail('')
    setPhone('')
    setAddress('')
    setLinkToNodeId(null)
    setShowLinkList(false)
    setError(null)
  }

  const closeAddNode = () => {
    setAddNodeOpen(false)
    setStep('type')
    setShowLinkList(false)
  }

  const openDeleteNode = async () => {
    if (!user?.uid) return
    setError(null)
    setDeleteNodeOpen(true)
    setIsDeleting(false)
    setNodeIdToDelete(null)
    try {
      const nodes = await getNodes(user.uid, 'context')
      setDeleteCandidates(nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes')
    }
  }

  const openAddConnection = async () => {
    if (!user?.uid) return
    setError(null)
    setAddConnectionOpen(true)
    setConnectionSourceId(null)
    setConnectionTargetId(null)
    try {
      const nodes = await getNodes(user.uid, 'context')
      setExistingNodes(nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes')
    }
  }

  const openDeleteEdge = async () => {
    if (!user?.uid) return
    setError(null)
    setDeleteEdgeOpen(true)
    setEdgeIdToDelete(null)
    try {
      const [nodes, edges] = await Promise.all([
        getNodes(user.uid, 'context'),
        getEdges(user.uid, 'context'),
      ])
      setExistingNodes(nodes)
      setEdgeCandidates(edges)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections')
    }
  }

  const openLinkList = async () => {
    if (!user?.uid) return
    setShowLinkList(true)
    try {
      const nodes = await getNodes(user.uid)
      setExistingNodes(nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user?.uid) return
    setError(null)
    setIsSubmitting(true)
    try {
      const data =
        nodeType === 'person'
          ? { type: 'person' as const, name, relationship, email, phone }
          : { type: 'place' as const, name, address }
      const newNodeId = await createNode(user.uid, data)
      if (linkToNodeId) {
        await createEdge(user.uid, newNodeId, linkToNodeId, 'context')
      }
      closeAddNode()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add node')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConnectCalendar = async () => {
    if (!user?.uid) return
    setError(null)
    setCalendarStatus(null)
    setIsConnectingCalendar(true)
    try {
      await connectGoogleCalendar(user.uid)
      setIsCalendarConnected(true)
      setCalendarStatus('Google Calendar connected.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect calendar'
      setError(message)
    } finally {
      setIsConnectingCalendar(false)
    }
  }

  const handleSyncCalendar = async () => {
    if (!user?.uid) return
    setError(null)
    setCalendarStatus(null)
    setIsSyncingCalendar(true)
    try {
      const imported = await syncGoogleCalendarTasks(user.uid)
      setCalendarStatus(`Synced ${imported} task occurrences from Google Calendar.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync calendar'
      setError(message)
    } finally {
      setIsSyncingCalendar(false)
    }
  }

  if (!user) {
    return (
      <section>
        <h1>Profile</h1>
        <p>Sign in to add and manage your graph nodes.</p>
        <Link to="/">Go to Home</Link>
      </section>
    )
  }

  return (
    <section>
      <h1>Profile</h1>
      <p>Profile details and settings will live here.</p>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleConnectCalendar}
          disabled={isConnectingCalendar}
          className="home-auth-button"
          style={{ marginTop: 0 }}
        >
          {isConnectingCalendar ? 'Connecting...' : isCalendarConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
        </button>
        <button
          type="button"
          onClick={handleSyncCalendar}
          disabled={!isCalendarConnected || isSyncingCalendar}
          className="home-auth-toggle-button"
          style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
        >
          {isSyncingCalendar ? 'Syncing...' : 'Sync calendar tasks'}
        </button>
      </div>
      {calendarStatus ? (
        <p style={{ marginTop: '0.5rem', color: '#166534' }}>{calendarStatus}</p>
      ) : null}

      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          onClick={openAddNode}
          className="home-auth-button"
          style={{ marginTop: 0 }}
        >
          Add node
        </button>
        <button
          type="button"
          onClick={openAddConnection}
          className="home-auth-toggle-button"
          style={{ marginTop: 0, marginLeft: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
        >
          Add connection
        </button>
        <button
          type="button"
          onClick={openDeleteNode}
          className="home-auth-toggle-button"
          style={{ marginTop: 0, marginLeft: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
        >
          Delete node
        </button>
        <button
          type="button"
          onClick={openDeleteEdge}
          className="home-auth-toggle-button"
          style={{ marginTop: 0, marginLeft: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
        >
          Delete connection
        </button>
      </div>

      {addNodeOpen && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            backgroundColor: '#f9fafb',
          }}
        >
          {step === 'type' && (
            <div>
              <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                Choose node type
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNodeType('person')
                    setStep('form')
                  }}
                  className="home-auth-toggle-button"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                  }}
                >
                  Person
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNodeType('place')
                    setStep('form')
                  }}
                  className="home-auth-toggle-button"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                  }}
                >
                  Place
                </button>
                <button
                  type="button"
                  onClick={closeAddNode}
                  className="home-auth-toggle-button"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '0.5rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
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

              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>
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
                    fontSize: '0.9rem',
                  }}
                >
                  {linkToNodeId
                    ? existingNodes.find((n) => n.id === linkToNodeId)?.name ??
                      'Change link'
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
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {existingNodes.length === 0 ? (
                      <li style={{ padding: '0.5rem', color: '#6b7280' }}>
                        No nodes yet. Add one first.
                      </li>
                    ) : (
                      existingNodes.map((node) => (
                        <li
                          key={node.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setLinkToNodeId(node.id)
                            setShowLinkList(false)
                          }}
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
                <p className="home-auth-error" style={{ marginBottom: '0.5rem' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setStep('type')}
                  className="home-auth-toggle-button"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '0.5rem',
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="home-auth-button"
                  style={{ marginTop: 0 }}
                >
                  {isSubmitting ? 'Adding…' : 'Add node'}
                </button>
                <button
                  type="button"
                  onClick={closeAddNode}
                  className="home-auth-toggle-button"
                  style={{
                    border: '1px solid #e5e7eb',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '0.5rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {addConnectionOpen && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            backgroundColor: '#f3f4ff',
          }}
        >
          <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Add a connection</p>
          <p style={{ marginBottom: '0.75rem', fontSize: 12, color: '#6b7280' }}>
            Choose a source node and a target node to connect in your context graph.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ marginBottom: '0.25rem', fontWeight: 600, fontSize: 12 }}>Source node</p>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  maxHeight: 180,
                  overflowY: 'auto',
                  backgroundColor: '#fff',
                }}
              >
                {existingNodes.length === 0 ? (
                  <li style={{ padding: '0.5rem', color: '#6b7280' }}>No nodes yet.</li>
                ) : (
                  existingNodes.map((node) => (
                    <li
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setConnectionSourceId(node.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setConnectionSourceId(node.id)
                        }
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor:
                          connectionSourceId === node.id ? '#e0f2fe' : 'transparent',
                        fontSize: 12,
                      }}
                    >
                      {node.name} ({node.type})
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ marginBottom: '0.25rem', fontWeight: 600, fontSize: 12 }}>Target node</p>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  maxHeight: 180,
                  overflowY: 'auto',
                  backgroundColor: '#fff',
                }}
              >
                {existingNodes.length === 0 ? (
                  <li style={{ padding: '0.5rem', color: '#6b7280' }}>No nodes yet.</li>
                ) : (
                  existingNodes.map((node) => (
                    <li
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setConnectionTargetId(node.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setConnectionTargetId(node.id)
                        }
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor:
                          connectionTargetId === node.id ? '#e0f2fe' : 'transparent',
                        fontSize: 12,
                      }}
                    >
                      {node.name} ({node.type})
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          {error != null && (
            <p className="home-auth-error" style={{ marginTop: '0.5rem' }}>
              {error}
            </p>
          )}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!connectionSourceId || !connectionTargetId}
              className="home-auth-button"
              style={{ marginTop: 0 }}
              onClick={async () => {
                if (!user?.uid || !connectionSourceId || !connectionTargetId) return
                setError(null)
                try {
                  await createEdge(user.uid, connectionSourceId, connectionTargetId, 'context')
                  setAddConnectionOpen(false)
                  setConnectionSourceId(null)
                  setConnectionTargetId(null)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to add connection')
                }
              }}
            >
              Add connection
            </button>
            <button
              type="button"
              className="home-auth-toggle-button"
              style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
              onClick={() => {
                setAddConnectionOpen(false)
                setConnectionSourceId(null)
                setConnectionTargetId(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteNodeOpen && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            backgroundColor: '#fef2f2',
          }}
        >
          <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Delete a node</p>
          <p style={{ marginBottom: '0.75rem', fontSize: 12, color: '#6b7280' }}>
            This will remove the node and any connections linked to it from your context graph.
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
            {deleteCandidates.length === 0 ? (
              <li style={{ padding: '0.5rem', color: '#6b7280' }}>No nodes to delete.</li>
            ) : (
              deleteCandidates.map((node) => (
                <li
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setNodeIdToDelete(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setNodeIdToDelete(node.id)
                    }
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: nodeIdToDelete === node.id ? '#fee2e2' : 'transparent',
                  }}
                >
                  {node.name} ({node.type})
                </li>
              ))
            )}
          </ul>
          {error != null && (
            <p className="home-auth-error" style={{ marginTop: '0.5rem' }}>
              {error}
            </p>
          )}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!nodeIdToDelete || isDeleting}
              className="home-auth-button"
              style={{ marginTop: 0 }}
              onClick={async () => {
                if (!user?.uid || !nodeIdToDelete) return
                setError(null)
                setIsDeleting(true)
                try {
                  await deleteNodeAndEdges(user.uid, nodeIdToDelete, 'context')
                  setDeleteCandidates((prev) => prev.filter((n) => n.id !== nodeIdToDelete))
                  setNodeIdToDelete(null)
                  setDeleteNodeOpen(false)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to delete node')
                } finally {
                  setIsDeleting(false)
                }
              }}
            >
              {isDeleting ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              className="home-auth-toggle-button"
              style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
              onClick={() => {
                setDeleteNodeOpen(false)
                setNodeIdToDelete(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteEdgeOpen && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            backgroundColor: '#eff6ff',
          }}
        >
          <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Delete a connection</p>
          <p style={{ marginBottom: '0.75rem', fontSize: 12, color: '#6b7280' }}>
            Choose a connection between two nodes to remove it from your context graph.
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
            {edgeCandidates.length === 0 ? (
              <li style={{ padding: '0.5rem', color: '#6b7280' }}>No connections to delete.</li>
            ) : (
              edgeCandidates.map((edge) => {
                const sourceName =
                  existingNodes.find((n) => n.id === edge.sourceNodeId)?.name ?? edge.sourceNodeId
                const targetName =
                  existingNodes.find((n) => n.id === edge.targetNodeId)?.name ?? edge.targetNodeId
                return (
                  <li
                    key={edge.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEdgeIdToDelete(edge.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setEdgeIdToDelete(edge.id)
                      }
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: edgeIdToDelete === edge.id ? '#dbeafe' : 'transparent',
                      fontSize: 12,
                    }}
                  >
                    {sourceName} → {targetName}
                  </li>
                )
              })
            )}
          </ul>
          {error != null && (
            <p className="home-auth-error" style={{ marginTop: '0.5rem' }}>
              {error}
            </p>
          )}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!edgeIdToDelete}
              className="home-auth-button"
              style={{ marginTop: 0 }}
              onClick={async () => {
                if (!user?.uid || !edgeIdToDelete) return
                setError(null)
                try {
                  await deleteEdge(user.uid, edgeIdToDelete, 'context')
                  setEdgeCandidates((prev) => prev.filter((e) => e.id !== edgeIdToDelete))
                  setEdgeIdToDelete(null)
                  setDeleteEdgeOpen(false)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to delete connection')
                }
              }}
            >
              Delete connection
            </button>
            <button
              type="button"
              className="home-auth-toggle-button"
              style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
              onClick={() => {
                setDeleteEdgeOpen(false)
                setEdgeIdToDelete(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default Profile
