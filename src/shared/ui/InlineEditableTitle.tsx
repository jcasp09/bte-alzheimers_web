import clsx from 'clsx'
import { PencilIcon } from './icons'
import { useInlineEditing } from '../hooks/useInlineEditing'
import styles from './InlineEditableTitle.module.css'

type Props = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
}

export function InlineEditableTitle({
  value,
  onChange,
  placeholder = 'Untitled',
  ariaLabel = 'Edit name',
  disabled,
}: Props) {
  const { editing, inputRef, startEditing, commit, handleKeyDown } = useInlineEditing(disabled)

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
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
      <span className={styles.text}>{value || placeholder}</span>
      <PencilIcon className={styles.pencil} aria-hidden="true" />
    </button>
  )
}
