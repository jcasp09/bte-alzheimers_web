/**
 * Currently only sets themes via `data-theme` on the <html> element,
 * and does not persist the choice. This will eventually be fixed with
 * localStorage + Firestore.
 */

export const THEMES = ['soft', 'warm', 'dark'] as const

export type Theme = typeof THEMES[number]

export const DEFAULT_THEME: Theme = 'soft'

const THEME_ATTRIBUTE = 'data-theme'

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
 * Apply a theme by setting `data-theme` on the <html> element. Notifies any
 * subscribers registered via subscribeToThemeChange().
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
