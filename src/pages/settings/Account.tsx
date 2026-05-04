import { useEffect, useRef, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
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

type FieldErrors = Partial<Record<keyof ProfileForm, string>>

const EMPTY_FORM: ProfileForm = { firstName: '', lastName: '', birthday: '' }
const EMPTY_ERRORS: FieldErrors = {}

const SUCCESS_BANNER_MS = 5000

const MAX_NAME_LENGTH = 50
/** Letters from any alphabet plus spaces, hyphens, apostrophes, and periods. */
const NAME_PATTERN = /^[\p{L}\s\-'.]+$/u
const MIN_BIRTHDAY = '1900-01-01'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES: readonly string[] = ['image/png', 'image/jpeg']

/** Today's date in YYYY-MM-DD using local time, suitable for <input type="date" max=...>. */
function todayISODate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function validateProfileForm(form: ProfileForm): FieldErrors {
  const errors: FieldErrors = {}

  for (const field of ['firstName', 'lastName'] as const) {
    const value = form[field].trim()
    if (value.length === 0)
      continue

    if (value.length > MAX_NAME_LENGTH) {
      errors[field] = `Must be ${MAX_NAME_LENGTH} characters or fewer.`
    } else if (!NAME_PATTERN.test(value)) {
      errors[field] = 'Use letters, spaces, hyphens, or apostrophes only.'
    }
  }

  const bday = form.birthday.trim()
  if (bday.length > 0) {
    // <input type="date"> normalizes to 'YYYY-MM-DD' or empty.
    const parsed = new Date(`${bday}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      errors.birthday = 'Please enter a valid date.'
    } else if (bday > todayISODate()) {
      errors.birthday = 'Birthday cannot be in the future.'
    } else if (bday < MIN_BIRTHDAY) {
      errors.birthday = 'Please enter a date on or after 1900.'
    }
  }

  return errors
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

function formatBytesMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Account() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [lastUid, setLastUid] = useState<string | null>(user?.uid ?? null)
  const [hasInitialized, setHasInitialized] = useState(false)

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS)

  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const photoURL = profile?.photoURL ?? null

  const currentUid = user?.uid ?? null
  if (lastUid !== currentUid) {
    setLastUid(currentUid)
    setForm(EMPTY_FORM)
    setInitialForm(EMPTY_FORM)
    setErrors(EMPTY_ERRORS)
    setHasInitialized(false)
  }

  if (!hasInitialized && profile != null) {
    const initial: ProfileForm = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      birthday: profile.birthday,
    }
    setForm(initial)
    setInitialForm(initial)
    setHasInitialized(true)
  }

  const isLoading = user != null && !hasInitialized

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
    // Clear that field's validation error as soon as the user edits it.
    setErrors((prev) => {
      if (prev[field] == null)
        return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleSave = async (event: SubmitEvent) => {
    event.preventDefault()
    if (user == null || !isDirty)
      return

    const validationErrors = validateProfileForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setError('Please fix the highlighted fields and try again.')
      return
    }

    setError(null)
    setStatusMessage(null)
    setErrors(EMPTY_ERRORS)
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

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      setError('Profile photo must be a JPG or PNG image.')
      return
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Profile photo must be ${formatBytesMB(MAX_PHOTO_BYTES)} or smaller. The selected file is ${formatBytesMB(file.size)}.`)
      return
    }

    setIsUploadingPhoto(true)

    try {
      const path = `users/${user.uid}/profile-photo`
      const ref = storageRef(storage, path)
      await uploadBytes(ref, file, { contentType: file.type })
      const url = await getDownloadURL(ref)

      await updateProfile(user, { photoURL: url })
      await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true })

      setStatusMessage('Photo updated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload photo'
      setError(message)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (user == null || photoURL == null)
      return

    setError(null)
    setStatusMessage(null)
    setIsRemovingPhoto(true)

    try {
      const path = `users/${user.uid}/profile-photo`
      const ref = storageRef(storage, path)
      try {
        await deleteObject(ref)
      } catch (err) {
        const code = (err as { code?: string } | null)?.code
        if (code !== 'storage/object-not-found')
          throw err;
      }

      await updateProfile(user, { photoURL: null })
      await setDoc(doc(db, 'users', user.uid), { photoURL: null }, { merge: true })

      setStatusMessage('Photo removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove photo')
    } finally {
      setIsRemovingPhoto(false)
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
  const photoBusy = isUploadingPhoto || isRemovingPhoto
  const today = todayISODate()

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
            <p className={styles.photoHint}>JPG or PNG, up to 10 MB.</p>
            <div className={styles.photoButtonRow}>
              <button
                type="button"
                className="btn-ghost"
                onClick={handlePhotoButtonClick}
                disabled={photoBusy || isLoading}
              >
                {isUploadingPhoto ? 'Uploading…' : photoURL ? 'Change photo' : 'Upload photo'}
              </button>
              {photoURL != null && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleRemovePhoto}
                  disabled={photoBusy || isLoading}
                >
                  {isRemovingPhoto ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
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
              maxLength={MAX_NAME_LENGTH}
              value={form.firstName}
              onChange={handleFieldChange('firstName')}
              disabled={isLoading || isSaving}
              aria-invalid={errors.firstName != null}
              aria-describedby={errors.firstName != null ? 'firstName-error' : undefined}
            />
            {errors.firstName != null && (
              <p id="firstName-error" className={styles.fieldError}>{errors.firstName}</p>
            )}
          </label>
          <label className="field">
            <span>Last name</span>
            <input
              type="text"
              autoComplete="family-name"
              maxLength={MAX_NAME_LENGTH}
              value={form.lastName}
              onChange={handleFieldChange('lastName')}
              disabled={isLoading || isSaving}
              aria-invalid={errors.lastName != null}
              aria-describedby={errors.lastName != null ? 'lastName-error' : undefined}
            />
            {errors.lastName != null && (
              <p id="lastName-error" className={styles.fieldError}>{errors.lastName}</p>
            )}
          </label>
        </div>

        <label className="field">
          <span>Birthday</span>
          <input
            type="date"
            autoComplete="bday"
            min={MIN_BIRTHDAY}
            max={today}
            value={form.birthday}
            onChange={handleFieldChange('birthday')}
            disabled={isLoading || isSaving}
            aria-invalid={errors.birthday != null}
            aria-describedby={errors.birthday != null ? 'birthday-error' : undefined}
          />
          {errors.birthday != null && (
            <p id="birthday-error" className={styles.fieldError}>{errors.birthday}</p>
          )}
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
