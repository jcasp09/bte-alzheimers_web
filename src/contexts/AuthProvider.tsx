import { useEffect, useState, type ReactNode } from 'react'
import { type User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/auth'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return () => unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}
