import { useEffect, useId, useRef, useState, type RefObject, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { PencilIcon } from './icons'
import styles from './InlineEditableField.module.css'

type FieldKind = 'text' | 'email' | 'tel' | 'date' | 'textarea'

type Props = {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  kind?: FieldKind
  disabled?: boolean
  formatDisplay?: (raw: string) => string
}

export function InlineEditableField({
  label,
  value,
  onChange,
  placeholder = 'Click to edit',
  kind = 'text',
  disabled,
  formatDisplay,
}: Props) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement)
        inputRef.current.select()
    }
  }, [editing])

  const startEditing = () => {
    if (disabled) return
    setEditing(true)
  }

  const commit = () => setEditing(false)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (kind !== 'textarea' && e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      commit()
    }
  }

  const displayValue = value ? (formatDisplay ? formatDisplay(value) : value) : ''

  return (
    <div className={clsx(styles.row, kind === 'textarea' && styles.rowStacked)}>
      <label htmlFor={id} className={styles.label}>{label}</label>

      {editing ? (
        kind === 'textarea' ? (
          <textarea
            id={id}
            ref={inputRef as RefObject<HTMLTextAreaElement>}
            className={styles.input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            rows={4}
            disabled={disabled}
          />
        ) : (
          <input
            id={id}
            ref={inputRef as RefObject<HTMLInputElement>}
            type={kind}
            className={styles.input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
        )
      ) : (
        <button
          type="button"
          className={clsx(styles.value, !value && styles.valueEmpty)}
          onClick={startEditing}
          disabled={disabled}
          aria-label={`Edit ${label}`}
        >
          <span className={styles.valueText}>
            {displayValue || placeholder}
          </span>
          <PencilIcon className={styles.pencil} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
