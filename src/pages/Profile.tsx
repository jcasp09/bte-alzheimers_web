import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { connectGoogleCalendar, isGoogleCalendarConnected, syncGoogleCalendarTasks } from '../services/calendar'
import styles from './Profile.module.css'

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
      <p className={styles.intro}>Manage your account details and connected services.</p>

      <div className={clsx(styles.card, styles.cardWithGap)}>
        <h2 className={styles.cardTitle}>Account</h2>

        <div className={styles.field}>
          <p className={styles.fieldLabel}>Email</p>
          <p className={styles.fieldValue}>{user.email}</p>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitleTight}>Connected services</h2>
        <p className={styles.cardSubtitle}>
          Connect external services to import data into your graphs.
        </p>

        <div className={styles.serviceRow}>
          <div>
            <p className={styles.serviceName}>Google Calendar</p>
            <p className={clsx(styles.serviceStatus, isCalendarConnected && styles.serviceStatusConnected)}>
              {isCalendarConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
          <div className={styles.serviceActions}>
            <button
              type="button"
              onClick={handleConnectCalendar}
              disabled={isConnectingCalendar}
              className="btn-primary"
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
              className="btn-ghost"
            >
              {isSyncingCalendar ? 'Syncing…' : 'Sync tasks'}
            </button>
          </div>
        </div>

        {calendarStatus != null && (
          <p className={styles.statusMessage}>{calendarStatus}</p>
        )}
      </div>

      {error != null && (
        <p className={clsx('text-error', styles.pageError)}>
          {error}
        </p>
      )}
    </section>
  )
}

export default Profile
