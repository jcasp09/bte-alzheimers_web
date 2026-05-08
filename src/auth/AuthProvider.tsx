import { useEffect, useRef, useState, type ReactNode } from 'react'
import { type User, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth } from '../firebase/auth'
import { db } from '../firebase/firestore'
import { AuthContext, type Profile } from './AuthContext'
import { DEFAULT_THEME, THEMES, type Theme, getTheme, setTheme, subscribeToThemeChange } from '../settings/theme'

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/** Read the user's saved theme from users/{uid}.themePreference. */
async function loadCloudTheme(uid: string): Promise<Theme | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  const value = snap.data()?.themePreference
  return isTheme(value) ? value : null
}

/** Write the user's theme to users/{uid}.themePreference. */
async function saveCloudTheme(uid: string, theme: Theme): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), { themePreference: theme }, { merge: true })
  } catch (err) {
    console.warn('[theme] failed to write themePreference to Firestore:', err)
  }
}

/**
 * On sign-in, reconcile the user's theme between cloud and local.
 */
async function hydrateThemeForUser(uid: string, isCancelled: () => boolean): Promise<void> {
  try {
    const cloudTheme = await loadCloudTheme(uid)
    if (isCancelled())
      return

    if (cloudTheme != null) {
      setTheme(cloudTheme)
      return
    }

    const localTheme = getTheme()
    if (localTheme !== DEFAULT_THEME)
      await saveCloudTheme(uid, localTheme)
  } catch (err) {
    console.warn('[theme] failed to hydrate themePreference from Firestore:', err)
  }
}

/** Coerce a raw Firestore snapshot into a Profile, tolerating missing fields. */
function profileFromSnapshot(data: Record<string, unknown> | undefined): Profile {
  return {
    firstName: typeof data?.firstName === 'string' ? data.firstName : '',
    lastName: typeof data?.lastName === 'string' ? data.lastName : '',
    birthday: typeof data?.birthday === 'string' ? data.birthday : '',
    photoURL: typeof data?.photoURL === 'string' ? data.photoURL : null,
  }
}

/**
 * Latest profile snapshot tagged with the uid it came from. Tagging lets us
 * derive the public `profile` value safely: while a snapshot is in-flight after
 * a user switch, the stale data is hidden until the new UID's snapshot arrives.
 */
type ProfileSnapshot = { uid: string; data: Profile }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileSnapshot | null>(null)

  const userRef = useRef<User | null>(null)
  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (user == null)
      return

    let cancelled = false
    void hydrateThemeForUser(user.uid, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [user])

  // Subscribe to the user's Firestore profile doc so name/photo changes propagate.
  useEffect(() => {
    const uid = user?.uid
    if (uid == null)
      return

    const ref = doc(db, 'users', uid)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as Record<string, unknown> | undefined
        setProfileSnapshot({ uid, data: profileFromSnapshot(data) })
      },
      (err) => {
        console.warn('[profile] failed to subscribe to user doc:', err)
      },
    )
    return () => unsubscribe()
  }, [user?.uid])

  // Mirror every theme change to Firestore while a user is signed in.
  useEffect(() => {
    return subscribeToThemeChange((theme) => {
      const u = userRef.current
      if (u != null)
        void saveCloudTheme(u.uid, theme)
    })
  }, [])

  const profile: Profile | null =
    user != null && profileSnapshot != null && profileSnapshot.uid === user.uid
      ? profileSnapshot.data
      : null

  return <AuthContext.Provider value={{ user, profile }}>{children}</AuthContext.Provider>
}
