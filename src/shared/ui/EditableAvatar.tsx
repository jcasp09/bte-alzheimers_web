import { useRef, type MouseEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { CameraIcon, XIcon } from './icons'
import styles from './EditableAvatar.module.css'

type Props = {
  imageUrl?: string | null
  fallbackLabel: string
  onFilePicked: (file: File) => void
  onRemovePhoto?: () => void | Promise<void>
  removeAriaLabel?: string
  accept?: string
  disabled?: boolean
  uploading?: boolean
  removing?: boolean
  cornerLeft?: ReactNode
  cornerMiddle?: ReactNode
  cornerRight?: ReactNode
  ariaLabel?: string
  alwaysShowOverlay?: boolean
}

export function EditableAvatar({
  imageUrl,
  fallbackLabel,
  onFilePicked,
  onRemovePhoto,
  removeAriaLabel = 'Remove photo',
  accept = 'image/jpeg,image/png',
  disabled,
  uploading,
  removing,
  cornerLeft,
  cornerMiddle,
  cornerRight,
  ariaLabel = 'Change photo',
  alwaysShowOverlay,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const triggerPicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleRemoveClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (disabled || uploading || removing || !onRemovePhoto) return
    void onRemovePhoto()
  }

  const showRemoveBadge = Boolean(onRemovePhoto && imageUrl)

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={clsx(styles.button, imageUrl && styles.hasImage)}
        onClick={triggerPicker}
        disabled={disabled || uploading}
        aria-label={ariaLabel}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className={styles.image} />
        ) : (
          <span className={styles.fallback}>{fallbackLabel}</span>
        )}
        <span
          className={clsx(styles.overlay, alwaysShowOverlay && styles.overlayAlways)}
          aria-hidden="true"
        >
          {uploading ? (
            <span className={styles.uploadingDot}>…</span>
          ) : (
            <CameraIcon size={26} />
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.fileInput}
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFilePicked(f)
        }}
      />

      {showRemoveBadge ? (
        <button
          type="button"
          className={clsx(styles.removeBadge, removing && styles.removeBadgeBusy)}
          onClick={handleRemoveClick}
          disabled={disabled || uploading || removing}
          aria-label={removeAriaLabel}
          title={removeAriaLabel}
        >
          <XIcon size={12} />
        </button>
      ) : null}

      {cornerLeft ? <span className={clsx(styles.corner, styles.cornerLeft)}>{cornerLeft}</span> : null}
      {cornerMiddle ? <span className={clsx(styles.corner, styles.cornerMiddle)}>{cornerMiddle}</span> : null}
      {cornerRight ? <span className={clsx(styles.corner, styles.cornerRight)}>{cornerRight}</span> : null}
    </div>
  )
}
