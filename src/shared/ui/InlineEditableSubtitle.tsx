import clsx from 'clsx'
import { PencilIcon } from './icons'
import { useInlineEditing } from '../hooks/useInlineEditing'
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
  const { editing, inputRef, startEditing, commit, handleKeyDown } = useInlineEditing(disabled)
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
