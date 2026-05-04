import { type SubmitEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../services/firestore'
import { useAuth } from '../contexts/AuthContext'
import { signInWithEmailPassword, signOutUser, signUpWithEmailPassword } from '../services/auth'
import styles from './Home.module.css'

type AuthMode = 'signin' | 'signup'

function Home() {
  const { user } = useAuth()
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const userCredential = authMode === 'signin'
        ? await signInWithEmailPassword(email, password)
        : await signUpWithEmailPassword(email, password)

      const credentialUser = userCredential.user
      if (credentialUser?.uid != null && credentialUser.email != null) {
        await setDoc(
          doc(db, 'users', credentialUser.uid),
          { email: credentialUser.email },
          { merge: true },
        )
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
      <header className={styles.hero}>
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          className={styles.heroLogo}
          width={72}
          height={72}
        />
        <h1 className={styles.heroName}>Memory Jog</h1>
        <p className={styles.heroTagline}>
          Visual support for the people, places, and tasks that matter most.
        </p>
      </header>
      <div className={styles.layout}>
        <div className={styles.overview}>
          <h2>Your cognitive support hub</h2>
          <p>
            Use your account to save personalized relationship graphs, routines, and memory connections. Signing in lets
            you access your graph across devices and keeps your data safely associated with your profile.
          </p>
        </div>

        <div className={styles.authCard} aria-live="polite">
          {user ? (
            <div>
              <h2 className={styles.signedInTitle}>Welcome back</h2>
              <p className={styles.authSubtitle}>
                Signed in as <span className={styles.authEmail}>{user.email}</span>.
              </p>
              <div className={styles.signedInActions}>
                <Link to="/graph" className="btn-primary">
                  Open your graph
                </Link>
                <button type="button" onClick={handleSignOut} className="btn-ghost">
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.authToggle} role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signin'}
                  className={clsx(styles.authToggleButton, authMode === 'signin' && styles.authToggleButtonActive)}
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
                  className={clsx(styles.authToggleButton, authMode === 'signup' && styles.authToggleButtonActive)}
                  onClick={() => {
                    setAuthMode('signup')
                    setError(null)
                  }}
                >
                  Sign up
                </button>
              </div>

              <form className="form-stack" onSubmit={handleSubmit}>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Password</span>
                  <div className={styles.passwordRow}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>
                {error != null && <p className="text-error">{error}</p>}
                <button type="submit" disabled={isSubmitting} className={clsx('btn-primary', styles.submitButton)}>
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
