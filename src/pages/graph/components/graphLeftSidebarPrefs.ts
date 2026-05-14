const COLLAPSED_STORAGE_KEY = 'bte:graphLeftSidebarCollapsed'
const SECTION_STORAGE_PREFIX = 'bte:graphLeftSidebarSection:'

/** Read the persisted whole-sidebar collapsed flag. Falls back to expanded on parse error. */
export function readSidebarCollapsedPref(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Persist the whole-sidebar collapsed flag. Swallows storage errors (private mode, etc.). */
export function writeSidebarCollapsedPref(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore
  }
}

export type SidebarSectionId = 'tasks' | 'rings' | 'connections' | 'memories' | 'minimap'

/** Per-section default open state. Tasks lead the sidebar so they default open.
 *  Minimap is heavy and not always needed, so it defaults collapsed. */
const SECTION_DEFAULT_OPEN: Record<SidebarSectionId, boolean> = {
  tasks: true,
  rings: true,
  connections: true,
  memories: true,
  minimap: false,
}

/** Read whether a given section is open. Falls back to the section's default
 *  when no pref is stored (or storage is unavailable). */
export function readSectionOpenPref(section: SidebarSectionId): boolean {
  if (typeof window === 'undefined') return SECTION_DEFAULT_OPEN[section]
  try {
    const raw = window.localStorage.getItem(`${SECTION_STORAGE_PREFIX}${section}`)
    if (raw === '1') return true
    if (raw === '0') return false
    return SECTION_DEFAULT_OPEN[section]
  } catch {
    return SECTION_DEFAULT_OPEN[section]
  }
}

/** Persist whether a given section is open. Swallows storage errors. */
export function writeSectionOpenPref(section: SidebarSectionId, open: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${SECTION_STORAGE_PREFIX}${section}`, open ? '1' : '0')
  } catch {
    // ignore
  }
}
