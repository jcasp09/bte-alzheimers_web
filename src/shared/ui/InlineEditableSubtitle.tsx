import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { PencilIcon } from './icons'
import styles from './InlineEditableSubtitle.module.css'

type Props = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  formatDisplay?: (raw: string) => string
  inputType?: 'text' | 'date'
}

export function InlineEditableSubtitle({
  value,
  onChange,
  placeholder = 'Click to edit',
  ariaLabel = 'Edit',
  disabled,
  formatDisplay,
  inputType = 'text',
}: Props) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEditing = () => {
    if (disabled) return
    setEditing(true)
  }

  const commit = () => setEditing(false)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault()
      commit()
    }
  }

  const displayValue = value ? (formatDisplay ? formatDisplay(value) : value) : ''

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(styles.button, !value && styles.empty)}
    >
      <span className={styles.text}>{displayValue || placeholder}</span>
      <PencilIcon size={12} className={styles.pencil} aria-hidden="true" />
    </button>
  )
}
