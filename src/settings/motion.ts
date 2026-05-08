/**
 * System motion defers to the OS via @media (prefers-reduced-motion).
 * Reduce forces reduced motion regardless of OS settings.
 * Persists to localStorage only (per-device).
 */

export const MOTION_MODES = ['system', 'reduce'] as const

export type MotionMode = typeof MOTION_MODES[number]

export const DEFAULT_MOTION_MODE: MotionMode = 'system'

// Keep synced with index.html
const MOTION_ATTRIBUTE = 'data-motion'
const STORAGE_KEY = 'memoryJogMotion'

const motionChangeListeners = new Set<(mode: MotionMode) => void>()

function isMotionMode(value: string | null | undefined): value is MotionMode {
  return value != null && (MOTION_MODES as readonly string[]).includes(value)
}

/**
 * Returns the currently applied motion mode, falling back to the default if absent or unrecognized.
 */
export function getMotionMode(): MotionMode {
  if (typeof document === 'undefined')
    return DEFAULT_MOTION_MODE

  const value = document.documentElement.getAttribute(MOTION_ATTRIBUTE)
  return isMotionMode(value) ? value : DEFAULT_MOTION_MODE
}

/**
 * Read the persisted motion mode from localStorage.
 */
export function getStoredMotionMode(): MotionMode | null {
  if (typeof window === 'undefined')
    return null

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isMotionMode(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Apply a motion mode by setting `data-motion` on the <html> element.
 * Persists to localStorage and notifies subscribers.
 */
export function setMotionMode(mode: MotionMode): void {
  if (typeof document === 'undefined')
    return

  if (mode === DEFAULT_MOTION_MODE) {
    // Default mode = no attribute, lets the @media query alone decide.
    document.documentElement.removeAttribute(MOTION_ATTRIBUTE)
  } else {
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, mode)
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage may be unavailable
  }

  for (const listener of motionChangeListeners) {
    listener(mode)
  }
}

/**
 * Subscribe to motion mode changes triggered by setMotionMode().
 * Returns an unsubscribe function.
 */
export function subscribeToMotionChange(listener: (mode: MotionMode) => void): () => void {
  motionChangeListeners.add(listener)
  return () => {
    motionChangeListeners.delete(listener)
  }
}
