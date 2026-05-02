import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { connectGoogleCalendar, isGoogleCalendarConnected, syncGoogleCalendarTasks } from '../services/calendar'

function Profile() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isCalendarConnected, setIsCalendarConnected] = useState(false)
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false)
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false)
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null)

  useEffect(() => {
    if (user?.uid) {
      setIsCalendarConnected(isGoogleCalendarConnected(user.uid))
    } else {
      setIsCalendarConnected(false)
    }
  }, [user?.uid])

  const handleConnectCalendar = async () => {
    if (!user?.uid) {
      return
    }

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
    if (!user?.uid) {
      return
    }

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
      <p style={{ marginBottom: '1.5rem' }}>Manage your account details and connected services.</p>

      <div
        style={{
          padding: '1.25rem',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          backgroundColor: '#f9fafb',
          marginBottom: '1rem'
        }}
      >
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', marginTop: '0rem' }}>
          Account
        </h2>

        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Email</p>
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user.email}</p>
        </div>
      </div>

      <div
        style={{
          padding: '1.25rem',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          backgroundColor: '#f9fafb'
        }}
      >
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem', marginTop: '0rem' }}>
          Connected services
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
          Connect external services to import data into your graphs.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            backgroundColor: '#fff',
          }}
        >
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.15rem' }}>
              Google Calendar
            </p>
            <p style={{ fontSize: '0.75rem', color: isCalendarConnected ? '#16a34a' : '#6b7280' }}>
              {isCalendarConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleConnectCalendar}
              disabled={isConnectingCalendar}
              className="home-auth-button"
              style={{ marginTop: 0 }}
            >
              {isConnectingCalendar
                ? 'Connecting…'
                : isCalendarConnected
                  ? 'Reconnect'
                  : 'Connect'}
            </button>
            <button
              type="button"
              onClick={handleSyncCalendar}
              disabled={!isCalendarConnected || isSyncingCalendar}
              className="home-auth-toggle-button"
              style={{ border: '1px solid #e5e7eb', padding: '0.45rem 0.9rem', borderRadius: '0.5rem' }}
            >
              {isSyncingCalendar ? 'Syncing…' : 'Sync tasks'}
            </button>
          </div>
        </div>

        {calendarStatus != null && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#16a34a' }}>{calendarStatus}</p>
        )}
      </div>

      {error != null && (
        <p className="home-auth-error" style={{ marginTop: '0.75rem', fontSize: '1rem' }}>
          {error}
        </p>
      )}
    </section>
  )
}

export default Profile
