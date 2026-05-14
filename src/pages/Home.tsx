import { type ReactNode, type SubmitEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { doc, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../firebase/firestore'
import { useAuth, type Profile } from '../auth/AuthContext'
import { signInWithEmailPassword, signOutUser, signUpWithEmailPassword } from '../firebase/auth'
import {
  authEmailValidator,
  firstError,
  passwordValidator,
} from '../shared/validation/fieldValidators'
import { getNodes } from '../graph/data/nodes'
import { getMemories, type MemoryDoc } from '../memories/data/memories'
import styles from './Home.module.css'

type AuthMode = 'signin' | 'signup'

function scrollToId(id: string): void {
  const target = document.getElementById(id)
  if (target == null) return
  const reduceMotion = typeof window !== 'undefined'
    && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.getAttribute('data-motion') === 'reduce')
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

function Home() {
  const { user, profile } = useAuth()

  return (
    <section className={styles.page}>
      <Hero />
      <AudienceSection />
      <FeatureSection />
      {user ? <Dashboard user={user} profile={profile} /> : <AuthSection />}
    </section>
  )
}

export default Home

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroIntro}>
        <span className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} aria-hidden="true" />
          For everyone, at every stage of memory
        </span>
        <h1 className={styles.heroTitle}>
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className={styles.heroLogoInline}
          />
          A <span className={styles.heroTitleAccent}>calm visual map</span> of
          your life.
        </h1>
        <p className={styles.heroTagline}>
          Memory Jog turns the people, places, and memories most important
          to you into a single relationship graph &mdash; built for clarity, and
          designed to support cognitive wellbeing.
        </p>
        <div className={styles.heroActions}>
          <button
            type="button"
            onClick={() => scrollToId('get-started')}
            className={clsx('btn-primary', styles.heroPrimary)}
          >
            Get started
          </button>
          <button
            type="button"
            onClick={() => scrollToId('what-it-does')}
            className={clsx('btn-ghost', styles.heroSecondary)}
          >
            See how it works
          </button>
        </div>
      </div>
      <HeroGraph />
    </header>
  )
}

function HeroGraph() {
  return (
    <div className={styles.heroCanvas} aria-hidden="true">
      <svg
        viewBox="0 0 400 400"
        className={styles.heroCanvasSvg}
        role="img"
        focusable="false"
      >
        <circle cx="200" cy="200" r="78"  className={clsx(styles.heroOrbit, styles.heroOrbitInner)} />
        <circle cx="200" cy="200" r="148" className={styles.heroOrbit} />

        <line x1="200" y1="200" x2="128" y2="138" className={styles.heroLink} />
        <line x1="200" y1="200" x2="272" y2="138" className={styles.heroLink} />
        <line x1="200" y1="200" x2="282" y2="262" className={styles.heroLink} />
        <line x1="200" y1="200" x2="120" y2="262" className={styles.heroLink} />
        <line x1="200" y1="200" x2="56"  y2="200" className={styles.heroLink} />
        <line x1="200" y1="200" x2="344" y2="200" className={styles.heroLink} />

        <g className={styles.heroSelfGroup}>
          <circle cx="200" cy="200" r="34" className={clsx(styles.heroNode, styles.heroNodeSelf)} />
          <text x="200" y="200" className={clsx(styles.heroNodeLabel, styles.heroNodeLabelSelf)}>You</text>
        </g>

        <g className={styles.heroFloatA}>
          <circle cx="128" cy="138" r="26" className={clsx(styles.heroNode, styles.heroNodePerson)} />
          <text x="128" y="138" className={styles.heroNodeLabel}>Mom</text>
        </g>
        <g className={styles.heroFloatB}>
          <circle cx="272" cy="138" r="26" className={clsx(styles.heroNode, styles.heroNodePerson)} />
          <text x="272" y="138" className={styles.heroNodeLabel}>Sam</text>
        </g>

        <g className={styles.heroFloatC}>
          <circle cx="56" cy="200" r="24" className={clsx(styles.heroNode, styles.heroNodePlace)} />
          <text x="56" y="200" className={styles.heroNodeLabel}>Home</text>
        </g>
        <g className={styles.heroFloatD}>
          <circle cx="344" cy="200" r="24" className={clsx(styles.heroNode, styles.heroNodeMemory)} />
          <text x="344" y="200" className={styles.heroNodeLabel}>Trip</text>
        </g>
        <g className={styles.heroFloatB}>
          <circle cx="282" cy="262" r="22" className={clsx(styles.heroNode, styles.heroNodePerson)} />
          <text x="282" y="262" className={styles.heroNodeLabel}>Dr.</text>
        </g>
        <g className={styles.heroFloatA}>
          <circle cx="120" cy="262" r="22" className={clsx(styles.heroNode, styles.heroNodePlace)} />
          <text x="120" y="262" className={styles.heroNodeLabel}>Park</text>
        </g>
      </svg>
    </div>
  )
}

function AudienceSection() {
  return (
    <section className={styles.section} aria-labelledby="audience-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionEyebrow}>Who it's for</p>
        <h2 id="audience-title" className={styles.sectionTitle}>
          Built around the people who use it.
        </h2>
        <p className={styles.sectionLede}>
          The same calm, visual interface works whether you set it up for yourself
          or alongside someone you care for.
        </p>
      </div>
      <div className={styles.audienceGrid}>
        <AudienceCard
          title="Living with memory changes"
          body="A familiar, at-a-glance picture of the people and places that matter. Easier to read than long lists or text-heavy apps."
          icon={<HeartIcon />}
        />
        <AudienceCard
          title="Caregivers & family"
          body="Help set up and maintain the graph on someone else's behalf. Add relatives, doctors, routines, and meaningful places together."
          icon={<UsersIcon />}
        />
        <AudienceCard
          title="Anyone who wants a clearer map"
          body="A friendlier way to keep track of your life. Your contacts, places, and memories in one connected canvas."
          icon={<CompassIcon />}
        />
      </div>
    </section>
  )
}

function AudienceCard(props: { title: string; body: string; icon: ReactNode }) {
  return (
    <article className={styles.audienceCard}>
      <div className={styles.audienceCardIcon} aria-hidden="true">{props.icon}</div>
      <h3
        className={styles.audienceCardTitle}
        dangerouslySetInnerHTML={{ __html: props.title }}
      />
      <p
        className={styles.audienceCardBody}
        dangerouslySetInnerHTML={{ __html: props.body }}
      />
    </article>
  )
}

function FeatureSection() {
  return (
    <section
      className={styles.section}
      aria-labelledby="features-title"
      id="what-it-does"
    >
      <div className={styles.sectionHeader}>
        <p className={styles.sectionEyebrow}>What you can do</p>
        <h2 id="features-title" className={styles.sectionTitle}>
          One canvas. Four ways it helps.
        </h2>
      </div>
      <div className={styles.featureGrid}>
        <FeatureCard
          swatchClass={styles.featureSwatchPerson}
          swatch={<DotIcon />}
          title="Relationship Graph"
          body="A central Self node surrounded by Favorites, Family, Friends, Community, and Places. Type &ldquo;daughter&rdquo; or &ldquo;doctor&rdquo; and the node lands in the right ring automatically."
        />
        <FeatureCard
          swatchClass={styles.featureSwatchMemory}
          swatch={<SparkleIcon />}
          title="Memory Bubbles"
          body="Capture a moment — photos, who was there, where it happened, when. Browse the timeline by date or focus on a single period."
        />
        <FeatureCard
          swatchClass={styles.featureSwatchPlace}
          swatch={<CalendarIcon />}
          title="Tasks & Calendar"
          body="See what's coming up with friendly labels like Today and Tomorrow. Connect calendars to bring imported events into the graph."
        />
        <FeatureCard
          swatchClass={styles.featureSwatchTheme}
          swatch={<PaletteIcon />}
          title="Yours, your way"
          body="Three themes (Soft, Warm, and Dark) plus motion controls and design tokens tuned for readability. Choose what suits you."
        />
      </div>
    </section>
  )
}

function FeatureCard(props: {
  swatchClass: string
  swatch: ReactNode
  title: string
  body: string
}) {
  return (
    <article className={styles.featureCard}>
      <div
        className={clsx(styles.featureSwatch, props.swatchClass)}
        aria-hidden="true"
      >
        {props.swatch}
      </div>
      <div className={styles.featureBody}>
        <h3
          className={styles.featureTitle}
          dangerouslySetInnerHTML={{ __html: props.title }}
        />
        <p
          className={styles.featureText}
          dangerouslySetInnerHTML={{ __html: props.body }}
        />
      </div>
    </article>
  )
}

function AuthSection() {
  return (
    <section
      className={styles.authStrip}
      aria-labelledby="auth-title"
      id="get-started"
    >
      <div className={styles.authPitch}>
        <h2 id="auth-title" className={styles.authPitchTitle}>
          Start your graph in under a minute.
        </h2>
        <p className={styles.authPitchText}>
          Your relationship graph, memories, and routines stay safely tied to
          your account and follow you across devices. Sign in to continue where
          you left off, or create a free account to begin.
        </p>
      </div>
      <AuthCard />
    </section>
  )
}

function AuthCard() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailError = authEmailValidator.validate(email)
  const passwordError = authMode === 'signup' ? passwordValidator.validate(password) : null
  const showEmailError = emailError != null && email.length > 0
  const showPasswordError = passwordError != null && password.length > 0
  const canSubmit = email.length > 0 && password.length > 0 && emailError == null && passwordError == null

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    setError(null)
    const validationError = firstError(
      authMode === 'signup'
        ? [[authEmailValidator, email], [passwordValidator, password]]
        : [[authEmailValidator, email]],
    )
    if (validationError != null) {
      setError(validationError)
      return
    }
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

  return (
    <div className={styles.authCard} aria-live="polite">
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
            maxLength={authEmailValidator.maxLength}
            aria-invalid={showEmailError || undefined}
            aria-describedby={showEmailError ? 'home-email-error' : undefined}
          />
          {showEmailError && (
            <p id="home-email-error" className="text-error" role="alert">{emailError}</p>
          )}
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
              maxLength={passwordValidator.maxLength}
              aria-invalid={showPasswordError || undefined}
              aria-describedby={showPasswordError ? 'home-password-error' : undefined}
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
          {showPasswordError && (
            <p id="home-password-error" className="text-error" role="alert">{passwordError}</p>
          )}
        </label>
        {error != null && <p className="text-error">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className={clsx('btn-primary', styles.submitButton)}
        >
          {isSubmitting ? 'Please wait…' : authMode === 'signin' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

/* ============================================================
 * Signed-in mini-dashboard. One-shot reads from memories and
 * the context graph. Intentionally does NOT read task data
 * since that area is being modified in parallel; we just link
 * to the Tasks page instead.
 * ============================================================ */

type DashboardStats = {
  people: number
  places: number
  memories: number
  latestMemory: MemoryDoc | null
}

type DashboardLoadState = {
  uid: string
  stats: DashboardStats | null
  loadError: string | null
}

function Dashboard(props: { user: User; profile: Profile | null }) {
  const { user, profile } = props
  // Keep load state tied to the uid it was fetched for. When user.uid changes,
  // the mismatch surfaces as `stats == null` automatically — no synchronous
  // setState inside the effect (which ESLint flags for causing extra renders).
  const [load, setLoad] = useState<DashboardLoadState | null>(null)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const current = load != null && load.uid === user.uid ? load : null
  const stats = current?.stats ?? null
  const loadError = current?.loadError ?? null

  useEffect(() => {
    let cancelled = false
    const uid = user.uid

    Promise.all([getNodes(uid), getMemories(uid)])
      .then(([nodes, memories]) => {
        if (cancelled) return
        let people = 0
        let places = 0
        for (const node of nodes) {
          if (node.type === 'person') people += 1
          else if (node.type === 'place') places += 1
        }
        let latest: MemoryDoc | null = null
        for (const memory of memories) {
          if (latest == null || memory.occurredOn > latest.occurredOn) {
            latest = memory
          }
        }
        setLoad({
          uid,
          stats: { people, places, memories: memories.length, latestMemory: latest },
          loadError: null,
        })
      })
      .catch(() => {
        if (cancelled) return
        setLoad({ uid, stats: null, loadError: 'We could not load your overview just now.' })
      })

    return () => { cancelled = true }
  }, [user.uid])

  const greetingName = useMemo(() => {
    const fn = profile?.firstName?.trim()
    if (fn && fn.length > 0) return fn
    if (user.email) return user.email.split('@')[0]
    return 'friend'
  }, [profile?.firstName, user.email])

  const handleSignOut = async () => {
    setSignOutError(null)
    try {
      await signOutUser()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out. Please try again.'
      setSignOutError(message)
    }
  }

  return (
    <section className={styles.dash} aria-labelledby="dash-title" id="get-started">
      <div className={styles.dashHero}>
        <p className={styles.dashGreeting}>Welcome back</p>
        <h2 id="dash-title" className={styles.dashTitle}>
          Hello, {greetingName}.
        </h2>
        <p className={styles.dashSubtitle}>
          Pick up where you left off, or take a moment to add to your graph.
        </p>

        <div className={styles.dashStats} aria-label="Your graph at a glance">
          <DashStat label="People"   value={stats?.people} />
          <DashStat label="Places"   value={stats?.places} />
          <DashStat label="Memories" value={stats?.memories} />
        </div>

        {loadError != null && <p className="text-error">{loadError}</p>}

        <div className={styles.dashActions}>
          <Link to="/graph" className={clsx('btn-primary', styles.heroPrimary)}>
            Continue to your graph
          </Link>
        </div>
      </div>

      <div className={styles.dashSide}>
        <article className={styles.dashCard}>
          <p className={styles.dashCardLabel}>Latest memory</p>
          {stats?.latestMemory ? (
            <>
              <h3 className={styles.dashCardTitle}>
                {stats.latestMemory.title.length > 0
                  ? stats.latestMemory.title
                  : 'Untitled memory'}
              </h3>
              <p className={styles.dashCardMeta}>
                {formatOccurredOn(stats.latestMemory.occurredOn)}
              </p>
            </>
          ) : (
            <p className={styles.dashCardEmpty}>
              {stats == null
                ? 'Loading…'
                : 'No memories yet — add one from the graph to start your timeline.'}
            </p>
          )}
          <Link to="/graph" className={styles.dashCardLink}>
            Open graph &rarr;
          </Link>
        </article>

        <article className={styles.dashCard}>
          <p className={styles.dashCardLabel}>Account</p>
          <p className={styles.dashCardMeta}>
            Signed in as {user.email ?? 'your account'}.
          </p>
          {signOutError != null && <p className="text-error">{signOutError}</p>}
          <button
            type="button"
            onClick={handleSignOut}
            className={clsx('btn-ghost', styles.dashSignOut)}
          >
            Sign out
          </button>
        </article>
      </div>
    </section>
  )
}

function DashStat(props: { label: string; value: number | undefined }) {
  return (
    <div className={styles.dashStat}>
      <span className={styles.dashStatValue}>
        {props.value == null ? '—' : props.value}
      </span>
      <span className={styles.dashStatLabel}>{props.label}</span>
    </div>
  )
}

function formatOccurredOn(s: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return s
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (Number.isNaN(date.getTime())) return s
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function DotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4 4h-2a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2z" />
      <circle cx="7.5"  cy="10.5" r="1" />
      <circle cx="12"   cy="7.5"  r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </svg>
  )
}
