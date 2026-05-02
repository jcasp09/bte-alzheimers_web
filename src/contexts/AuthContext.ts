import { createContext, useContext } from 'react'
import { type User } from 'firebase/auth'

export type AuthContextValue = { user: User | null }

/** Internal context store. Consumers should call `useAuth()` instead of reading this directly. */
export const AuthContext = createContext<AuthContextValue | null>(null)

/** Read the current auth state. Throws if used outside <AuthProvider />. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context == null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
