import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../../auth/AuthContext'
import { connectGoogleCalendar, isGoogleCalendarConnected, syncGoogleCalendarTasks } from '../../calendar/calendar'
import PageHeader from '../../shared/ui/PageHeader'
import Banner from '../../shared/ui/Banner'
import styles from './Integrations.module.css'

/** How long success banners stay visible before auto-dismissing. */
const SUCCESS_BANNER_MS = 5000

function Integrations() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isCalendarConnected, setIsCalendarConnected] = useState(false)
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false)
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false)
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null)

  useEffect(() => {
    setIsCalendarConnected(!!(user?.uid && isGoogleCalendarConnected(user.uid)))
  }, [user?.uid])

  // Auto-dismiss success banners after a short delay; errors stay until next action.
  useEffect(() => {
    if (calendarStatus == null)
      return
    const timer = window.setTimeout(() => setCalendarStatus(null), SUCCESS_BANNER_MS)
    return () => window.clearTimeout(timer)
  }, [calendarStatus])

  const handleConnectCalendar = async () => {
    if (!user?.uid)
      return

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
    if (!user?.uid)
      return

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

  if (user == null) {
    return (
      <div>
        <PageHeader
          title="Integrations"
          subtitle="Sign in to connect external services."
        />
        <p className={styles.signedOutText}>You are not signed in.</p>
        <Link to="/" className="btn-primary">Go to sign in</Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Connect external services to import data into your graphs."
      />

      {calendarStatus != null && (
        <Banner
          kind="success"
          message={calendarStatus}
          onDismiss={() => setCalendarStatus(null)}
        />
      )}
      {error != null && (
        <Banner
          kind="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Connected services</h3>

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
      </div>
    </div>
  )
}

export default Integrations
