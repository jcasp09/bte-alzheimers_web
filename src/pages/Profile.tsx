import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  createEdge,
  createNode,
  getNodes,
  type NodeDoc,
  type NodeType,
} from '../firebase/graph'

type AddNodeStep = 'type' | 'form'

function Profile() {
  const { user } = useAuth()
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [step, setStep] = useState<AddNodeStep>('type')
  const [nodeType, setNodeType] = useState<NodeType>('person')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [linkToNodeId, setLinkToNodeId] = useState<string | null>(null)
  const [showLinkList, setShowLinkList] = useState(false)
  const [existingNodes, setExistingNodes] = useState<NodeDoc[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openAddNode = () => {
    setAddNodeOpen(true)
    setStep('type')
    setNodeType('person')
    setName('')
    setRelationship('')
    setEmail('')
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
          ? { type: 'person' as const, name, relationship, email }
          : { type: 'place' as const, name, address }
      const newNodeId = await createNode(user.uid, data)
      if (linkToNodeId) {
        await createEdge(user.uid, newNodeId, linkToNodeId)
      }
      closeAddNode()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add node')
    } finally {
      setIsSubmitting(false)
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

      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          onClick={openAddNode}
          className="home-auth-button"
          style={{ marginTop: 0 }}
        >
          Add node
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      <span>Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
    </section>
  )
}

export default Profile
