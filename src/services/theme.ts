export const THEMES = ['soft', 'warm', 'dark'] as const

export type Theme = typeof THEMES[number]

export const DEFAULT_THEME: Theme = 'soft'

// Keep synced with index.html
const THEME_ATTRIBUTE = 'data-theme'
const STORAGE_KEY = 'memoryJogTheme'
const THEME_COLOR_META_NAME = 'theme-color'
const THEME_COLOR_TOKEN = '--color-page'

const themeChangeListeners = new Set<(theme: Theme) => void>()

function isTheme(value: string | null | undefined): value is Theme {
  return value != null && (THEMES as readonly string[]).includes(value)
}

/**
 * Returns the currently applied theme. Falls back to the default if no
 * `data-theme` attribute is set or the value is unrecognized.
 */
export function getTheme(): Theme {
  if (typeof document === 'undefined')
    return DEFAULT_THEME

  const value = document.documentElement.getAttribute(THEME_ATTRIBUTE)
  return isTheme(value) ? value : DEFAULT_THEME
}

/**
 * Read the persisted theme from localStorage.
 */
export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined')
    return null

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Sync the <meta name="theme-color"> tag with the active theme's page color.
 */
export function applyThemeColorMeta(): void {
  if (typeof document === 'undefined')
    return

  const color = getThemeColor(THEME_COLOR_TOKEN)
  if (!color)
    return

  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${THEME_COLOR_META_NAME}"]`)
  if (meta == null) {
    meta = document.createElement('meta')
    meta.name = THEME_COLOR_META_NAME
    document.head.appendChild(meta)
  }
  meta.content = color
}

/**
 * Apply a theme by setting `data-theme` on the <html> element.
 * Notifies subscribers registered via subscribeToThemeChange().
 */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined')
    return

  if (theme === DEFAULT_THEME) {
    // Setting a default theme is the same thing as removing the theme attribute
    document.documentElement.removeAttribute(THEME_ATTRIBUTE)
  } else {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme)
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage may be unavailable
  }

  // Sync browser chrome with the new theme. Must run after the attribute change.
  applyThemeColorMeta()

  for (const listener of themeChangeListeners) {
    listener(theme)
  }
}

/**
 * Subscribe to theme changes triggered by setTheme(). Returns an unsubscribe function.
 */
export function subscribeToThemeChange(listener: (theme: Theme) => void): () => void {
  themeChangeListeners.add(listener)
  return () => {
    themeChangeListeners.delete(listener)
  }
}

/**
 * Read the resolved value of a CSS custom property from <html>.
 */
export function getThemeColor(token: string): string {
  return typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}
