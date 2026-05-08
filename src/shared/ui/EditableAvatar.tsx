import { useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { CameraIcon } from './icons'
import styles from './EditableAvatar.module.css'

type Props = {
  imageUrl?: string | null
  fallbackLabel: string
  onFilePicked: (file: File) => void
  accept?: string
  disabled?: boolean
  uploading?: boolean
  cornerLeft?: ReactNode
  cornerMiddle?: ReactNode
  cornerRight?: ReactNode
  ariaLabel?: string
}

export function EditableAvatar({
  imageUrl,
  fallbackLabel,
  onFilePicked,
  accept = 'image/jpeg,image/png',
  disabled,
  uploading,
  cornerLeft,
  cornerMiddle,
  cornerRight,
  ariaLabel = 'Change photo',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const triggerPicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

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
        <span className={styles.overlay} aria-hidden="true">
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

      {cornerLeft ? <span className={clsx(styles.corner, styles.cornerLeft)}>{cornerLeft}</span> : null}
      {cornerMiddle ? <span className={clsx(styles.corner, styles.cornerMiddle)}>{cornerMiddle}</span> : null}
      {cornerRight ? <span className={clsx(styles.corner, styles.cornerRight)}>{cornerRight}</span> : null}
    </div>
  )
}
