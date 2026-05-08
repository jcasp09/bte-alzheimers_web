import { type KeyboardEvent, type RefObject, useRef } from 'react'

/**
 * Keyboard navigation for a WAI-ARIA radio group.
 * Pair with roving tabindex on the rendered options.
 */
export function useRadioGroupKeyboard<T extends HTMLElement = HTMLButtonElement>({
  count,
  onSelect,
}: {
  count: number
  onSelect: (index: number) => void
}): {
  optionRefs: RefObject<(T | null)[]>
  handleKeyDown: (event: KeyboardEvent<T>, index: number) => void
} {
  const optionRefs = useRef<(T | null)[]>([])

  function handleKeyDown(event: KeyboardEvent<T>, index: number): void {
    let nextIndex = index

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % count
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + count) % count
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = count - 1
        break
      default:
        return
    }

    event.preventDefault()
    onSelect(nextIndex)
    optionRefs.current[nextIndex]?.focus()
  }

  return { optionRefs, handleKeyDown }
}
