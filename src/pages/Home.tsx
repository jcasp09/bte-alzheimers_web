import { type FormEvent, useEffect, useState } from 'react'
import { type User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/firebaseConfig'
import { signInWithEmailPassword, signOutUser, signUpWithEmailPassword } from '../firebase/auth'

type AuthMode = 'signin' | 'signup'

function Home() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return () => unsubscribe()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (authMode === 'signin') {
        await signInWithEmailPassword(email, password)
      } else {
        await signUpWithEmailPassword(email, password)
      }

      setEmail('')
      setPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    setError(null)
    try {
      await signOutUser()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out. Please try again.'
      setError(message)
    }
  }

  return (
    <section>
      <h1>Home</h1>
      <p>Welcome to the BTE-Alzheimer&apos;s project dashboard.</p>
      <div className="home-layout">
        <div className="home-overview">
          <h2>Your cognitive support hub</h2>
          <p>
            Use your account to save personalized relationship graphs, routines, and memory connections. Signing in lets
            you access your graph across devices and keeps your data safely associated with your profile.
          </p>
        </div>
        
        {/* Auth card */}
        <div className="home-auth-card" aria-live="polite">
          {user ? (
            <div>
              {/* Signed in view */}
              <h2>Signed in</h2>
              <p className="home-auth-subtitle">
                You&apos;re signed in as <span className="home-auth-email">{user.email}</span>.
              </p>
              <button type="button" onClick={handleSignOut} className="home-auth-button">
                Sign out
              </button>
            </div>
          ) : (
            <div>
              {/* Login/Sign up toggle */}
              <div className="home-auth-toggle" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signin'}
                  className={authMode === 'signin' ? 'home-auth-toggle-button active' : 'home-auth-toggle-button'}
                  onClick={() => {
                    setAuthMode('signin')
                    setError(null)
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  className={authMode === 'signup' ? 'home-auth-toggle-button active' : 'home-auth-toggle-button'}
                  onClick={() => {
                    setAuthMode('signup')
                    setError(null)
                  }}
                >
                  Sign up
                </button>
              </div>

              {/* Sign in form - Email and Password */}
              <form className="home-auth-form" onSubmit={handleSubmit}>
                <label className="home-auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label className="home-auth-field">
                  <span>Password</span>
                  <div className="home-auth-password-row">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="home-auth-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>
                {/* Error message */}
                {error != null && <p className="home-auth-error">{error}</p>}
                {/* Submit button */}
                <button type="submit" disabled={isSubmitting} className="home-auth-button">
                  {isSubmitting ? 'Please wait…' : authMode === 'signin' ? 'Log in' : 'Create account'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default Home
