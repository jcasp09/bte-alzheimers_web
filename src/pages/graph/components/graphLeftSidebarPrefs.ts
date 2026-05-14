const COLLAPSED_STORAGE_KEY = 'bte:graphLeftSidebarCollapsed'

/** Read the persisted collapsed flag. Falls back to expanded on parse error. */
export function readSidebarCollapsedPref(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Persist the collapsed flag. Swallows storage errors (private mode, etc.). */
export function writeSidebarCollapsedPref(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore
  }
}
