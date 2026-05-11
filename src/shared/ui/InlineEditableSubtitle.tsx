import clsx from 'clsx'
import { PencilIcon } from './icons'
import { useInlineEditing } from '../hooks/useInlineEditing'
import type { FieldValidator } from '../validation/fieldValidators'
import styles from './InlineEditableSubtitle.module.css'

type Props = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  formatDisplay?: (raw: string) => string
  inputType?: 'text' | 'date'
  validator?: FieldValidator
}

export function InlineEditableSubtitle({
  value,
  onChange,
  placeholder = 'Click to edit',
  ariaLabel = 'Edit',
  disabled,
  formatDisplay,
  inputType = 'text',
  validator,
}: Props) {
  const { editing, inputRef, startEditing, commit, handleKeyDown } = useInlineEditing(disabled)
  const displayValue = value ? (formatDisplay ? formatDisplay(value) : value) : ''
  const errorMessage = validator ? validator.validate(value) : null
  const showError = errorMessage != null && (editing || value.length > 0)

  if (editing) {
    return (
      <span className={styles.wrap}>
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
          maxLength={validator?.maxLength}
          aria-invalid={showError || undefined}
        />
        {showError ? (
          <span className={styles.error} role="alert">{errorMessage}</span>
        ) : null}
      </span>
    )
  }

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        onClick={startEditing}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={showError || undefined}
        className={clsx(styles.button, !value && styles.empty)}
      >
        <span className={styles.text}>{displayValue || placeholder}</span>
        <PencilIcon size={12} className={styles.pencil} aria-hidden="true" />
      </button>
      {showError ? (
        <span className={styles.error} role="alert">{errorMessage}</span>
      ) : null}
    </span>
  )
}
