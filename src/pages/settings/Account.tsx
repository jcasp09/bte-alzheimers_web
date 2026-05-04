import { useEffect, useRef, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { updateProfile } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../contexts/AuthContext'
import { signOutUser } from '../../services/auth'
import { db } from '../../services/firestore'
import { storage } from '../../services/storage'
import SettingsPageHeader from '../../components/SettingsPageHeader'
import SettingsBanner from '../../components/SettingsBanner'
import styles from './Account.module.css'

type ProfileForm = {
  firstName: string
  lastName: string
  birthday: string
}

const EMPTY_FORM: ProfileForm = { firstName: '', lastName: '', birthday: '' }

/** How long success banners stay visible before auto-dismissing. */
const SUCCESS_BANNER_MS = 5000

/** Read first/last/birthday from users/{uid}. Tolerates missing fields. */
async function loadProfile(uid: string): Promise<ProfileForm> {
  const snap = await getDoc(doc(db, 'users', uid))
  const data = snap.data() ?? {}
  return {
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    birthday: typeof data.birthday === 'string' ? data.birthday : '',
  }
}

function buildDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter((part) => part.length > 0).join(' ')
}

function getInitials(firstName: string, lastName: string, fallbackEmail: string | null | undefined): string {
  const first = firstName.trim().charAt(0).toUpperCase()
  const last = lastName.trim().charAt(0).toUpperCase()
  if (first || last)
    return `${first}${last}`

  if (fallbackEmail && fallbackEmail.length > 0)
    return fallbackEmail.charAt(0).toUpperCase()

  return '?'
}

function Account() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM)
  const [photoURL, setPhotoURL] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load profile data when the signed-in user becomes available.
  useEffect(() => {
    if (user?.uid == null) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    void (async () => {
      try {
        const loaded = await loadProfile(user.uid)
        if (cancelled)
          return

        setForm(loaded)
        setInitialForm(loaded)
        setPhotoURL(user.photoURL)
      } catch (err) {
        if (cancelled)
          return

        const message = err instanceof Error ? err.message : 'Failed to load profile'
        setError(message)
      } finally {
        if (!cancelled)
          setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.uid, user?.photoURL])

  // Auto-dismiss success banners after a short delay; errors stay until next action.
  useEffect(() => {
    if (statusMessage == null)
      return
    const timer = window.setTimeout(() => setStatusMessage(null), SUCCESS_BANNER_MS)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  const isDirty =
    form.firstName !== initialForm.firstName ||
    form.lastName !== initialForm.lastName ||
    form.birthday !== initialForm.birthday

  const handleFieldChange = (field: keyof ProfileForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSave = async (event: SubmitEvent) => {
    event.preventDefault()
    if (user == null || !isDirty)
      return

    setError(null)
    setStatusMessage(null)
    setIsSaving(true)

    try {
      const trimmed: ProfileForm = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthday: form.birthday.trim(),
      }

      await setDoc(
        doc(db, 'users', user.uid),
        {
          firstName: trimmed.firstName,
          lastName: trimmed.lastName,
          birthday: trimmed.birthday,
        },
        { merge: true },
      )

      const displayName = buildDisplayName(trimmed.firstName, trimmed.lastName)
      if (displayName !== (user.displayName ?? ''))
        await updateProfile(user, { displayName: displayName.length > 0 ? displayName : null })

      setForm(trimmed)
      setInitialForm(trimmed)
      setStatusMessage('Account saved.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhotoButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Always reset the input so the user can re-pick the same file later.
    event.target.value = ''
    if (file == null || user == null)
      return

    setError(null)
    setStatusMessage(null)
    setIsUploadingPhoto(true)

    try {
      const path = `users/${user.uid}/profile-photo`
      const ref = storageRef(storage, path)
      await uploadBytes(ref, file, { contentType: file.type })
      const url = await getDownloadURL(ref)

      await updateProfile(user, { photoURL: url })
      await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true })

      setPhotoURL(url)
      setStatusMessage('Photo updated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload photo'
      setError(message)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleSignOut = async () => {
    setError(null)
    setStatusMessage(null)
    setIsSigningOut(true)
    try {
      await signOutUser()
      navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out'
      setError(message)
      setIsSigningOut(false)
    }
  }

  if (user == null) {
    return (
      <div>
        <SettingsPageHeader
          title="Account"
          subtitle="Sign in to view and edit your account details."
        />
        <p className={styles.signedOutText}>You are not signed in.</p>
        <Link to="/" className="btn-primary">Go to sign in</Link>
      </div>
    )
  }

  const initials = getInitials(form.firstName, form.lastName, user.email)

  return (
    <div>
      <SettingsPageHeader
        title="Account"
        subtitle="Update your name, photo, and other personal details."
      />

      {statusMessage != null && (
        <SettingsBanner
          kind="success"
          message={statusMessage}
          onDismiss={() => setStatusMessage(null)}
        />
      )}
      {error != null && (
        <SettingsBanner
          kind="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <form className={styles.card} onSubmit={handleSave} noValidate>
        <h3 className={styles.cardTitle}>Profile</h3>

        <div className={styles.photoRow}>
          <div className={styles.avatar} aria-hidden="true">
            {photoURL ? (
              <img src={photoURL} alt="" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatarInitials}>{initials}</span>
            )}
          </div>
          <div className={styles.photoActions}>
            <p className={styles.photoLabel}>Profile photo</p>
            <p className={styles.photoHint}>JPG or PNG, up to a few MB.</p>
            <button
              type="button"
              className="btn-ghost"
              onClick={handlePhotoButtonClick}
              disabled={isUploadingPhoto || isLoading}
            >
              {isUploadingPhoto ? 'Uploading…' : photoURL ? 'Change photo' : 'Upload photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              onChange={handlePhotoChange}
              className={styles.hiddenFileInput}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        </div>

        <div className={styles.nameRow}>
          <label className="field">
            <span>First name</span>
            <input
              type="text"
              autoComplete="given-name"
              value={form.firstName}
              onChange={handleFieldChange('firstName')}
              disabled={isLoading || isSaving}
            />
          </label>
          <label className="field">
            <span>Last name</span>
            <input
              type="text"
              autoComplete="family-name"
              value={form.lastName}
              onChange={handleFieldChange('lastName')}
              disabled={isLoading || isSaving}
            />
          </label>
        </div>

        <label className="field">
          <span>Birthday</span>
          <input
            type="date"
            autoComplete="bday"
            value={form.birthday}
            onChange={handleFieldChange('birthday')}
            disabled={isLoading || isSaving}
          />
        </label>

        <div className={styles.formActions}>
          <button
            type="submit"
            className="btn-primary"
            disabled={!isDirty || isSaving || isLoading}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className={clsx(styles.card, styles.cardWithGap)}>
        <h3 className={styles.cardTitle}>Account access</h3>
        <div className={styles.field}>
          <p className={styles.fieldLabel}>Email</p>
          <p className={styles.fieldValue}>{user.email}</p>
          <p className={styles.fieldHint}>Email cannot be changed at this time.</p>
        </div>
      </div>

      <div className={clsx(styles.card, styles.cardWithGap)}>
        <h3 className={styles.cardTitle}>Sign out</h3>
        <p className={styles.cardSubtitle}>You will be returned to the sign-in screen.</p>
        <button
          type="button"
          className="btn-ghost"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

export default Account
