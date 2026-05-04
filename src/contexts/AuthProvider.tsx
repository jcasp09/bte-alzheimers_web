import { useEffect, useRef, useState, type ReactNode } from 'react'
import { type User, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth } from '../services/auth'
import { db } from '../services/firestore'
import { AuthContext } from './AuthContext'
import { THEMES, type Theme, getTheme, setTheme, subscribeToThemeChange } from '../services/theme'

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
  } catch {
    // Network/permission failure, but local state still correct
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
    } else {
      await saveCloudTheme(uid, getTheme())
    }
  } catch {
    // Network/permission failure, but local state still correct
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

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

  // Mirror every theme change to Firestore while a user is signed in.
  useEffect(() => {
    return subscribeToThemeChange((theme) => {
      const u = userRef.current
      if (u != null)
        void saveCloudTheme(u.uid, theme)
    })
  }, [])

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}
