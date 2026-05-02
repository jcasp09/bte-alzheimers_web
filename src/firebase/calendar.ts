import { GRAPH_IDS, removePassedTaskNodes, upsertNode } from './graph'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

type GoogleCalendarEvent = {
  id?: string
  summary?: string
  location?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[]
}

type StoredToken = {
  accessToken: string
  expiresAtMs: number
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
          }) => {
            requestAccessToken: (config?: { prompt?: string }) => void
          }
        }
      }
    }
  }
}

const GOOGLE_OAUTH_SCRIPT = 'https://accounts.google.com/gsi/client'
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Centralized calendar sync settings for easy tuning.
export const CALENDAR_SYNC_CONFIG = {
  calendarId: 'primary',
  futureDaysToSync: 7,
  maxEventsPerSync: 10,
  expandRecurringEvents: true,
  prioritizeWithinDays: 7,
  oauthPrompt: 'consent' as const,
}

function getStorageKey(uid: string) {
  return `calendar_google_token_${uid}`
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google OAuth script'))
    document.head.appendChild(script)
  })
}

export async function connectGoogleCalendar(uid: string): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID as string | undefined
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_CALENDAR_CLIENT_ID in environment variables')
  }
  await loadScript(GOOGLE_OAUTH_SCRIPT)
  const oauth = window.google?.accounts?.oauth2
  if (!oauth) throw new Error('Google OAuth client is unavailable')

  const token = await new Promise<GoogleTokenResponse>((resolve) => {
    const tokenClient = oauth.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: resolve,
    })
    tokenClient.requestAccessToken({ prompt: CALENDAR_SYNC_CONFIG.oauthPrompt })
  })

  if (token.error || !token.access_token) {
    throw new Error(token.error ?? 'Google authorization failed')
  }

  const expiresAtMs = Date.now() + (token.expires_in ?? 3600) * 1000
  const stored: StoredToken = { accessToken: token.access_token, expiresAtMs }
  localStorage.setItem(getStorageKey(uid), JSON.stringify(stored))
}

export function isGoogleCalendarConnected(uid: string): boolean {
  const raw = localStorage.getItem(getStorageKey(uid))
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as StoredToken
    return Boolean(parsed.accessToken) && parsed.expiresAtMs > Date.now()
  } catch {
    return false
  }
}

function getStoredToken(uid: string): string {
  const raw = localStorage.getItem(getStorageKey(uid))
  if (!raw) throw new Error('Calendar is not connected')
  const parsed = JSON.parse(raw) as StoredToken
  if (!parsed.accessToken || parsed.expiresAtMs <= Date.now()) {
    throw new Error('Calendar token expired. Please reconnect Google Calendar.')
  }
  return parsed.accessToken
}

function toIso(dateTime?: string, date?: string): string {
  if (dateTime) return dateTime
  if (date) return `${date}T00:00:00.000Z`
  return ''
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function computePriority(startAtIso: string): number {
  const startAtMs = new Date(startAtIso).getTime()
  if (Number.isNaN(startAtMs)) return 0
  const deltaMs = startAtMs - Date.now()
  const windowMs = MS_PER_DAY * CALENDAR_SYNC_CONFIG.prioritizeWithinDays
  return clamp(1 - deltaMs / windowMs, 0, 1)
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Google Calendar API failed (${response.status})`)
  }
  return (await response.json()) as T
}

export async function syncGoogleCalendarTasks(uid: string): Promise<number> {
  const token = getStoredToken(uid)
  const now = new Date()
  await removePassedTaskNodes(uid, now.toISOString())
  const rangeEnd = new Date(now.getTime() + MS_PER_DAY * CALENDAR_SYNC_CONFIG.futureDaysToSync)
  const calendarId = CALENDAR_SYNC_CONFIG.calendarId
  const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  eventsUrl.searchParams.set('singleEvents', String(CALENDAR_SYNC_CONFIG.expandRecurringEvents))
  eventsUrl.searchParams.set('orderBy', 'startTime')
  eventsUrl.searchParams.set('maxResults', String(CALENDAR_SYNC_CONFIG.maxEventsPerSync))
  eventsUrl.searchParams.set('timeMin', now.toISOString())
  eventsUrl.searchParams.set('timeMax', rangeEnd.toISOString())

  const eventsData = await fetchJson<GoogleCalendarEventsResponse>(eventsUrl.toString(), token)
  const events = eventsData.items ?? []

  let importedCount = 0
  await Promise.all(events.map(async (event) => {
    const eventId = event.id ?? ''
    const startAt = toIso(event.start?.dateTime, event.start?.date)
    const endAt = toIso(event.end?.dateTime, event.end?.date)
    if (!eventId || !startAt) return

    const nodeId = `gcal:${calendarId}:${eventId}:${startAt}`
    const title = event.summary?.trim() || 'Untitled task'
    const priority = computePriority(startAt)

    await upsertNode(uid, nodeId, {
      type: 'task',
      name: title,
      title,
      startAt,
      endAt,
      calendarEventId: eventId,
      priority,
      location: event.location ?? '',
    }, GRAPH_IDS.tasks)
    importedCount += 1
  }))
  return importedCount
}
