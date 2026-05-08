import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

/** Shared toggle/focus/keyboard logic for the inline-editable shell components. */
export function useInlineEditing(disabled?: boolean) {
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

  return { editing, inputRef, startEditing, commit, handleKeyDown }
}
