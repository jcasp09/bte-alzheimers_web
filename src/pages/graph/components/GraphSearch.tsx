import { type RefObject } from 'react'
import clsx from 'clsx'
import type { Layer } from '../../../graph/model/flowConstants'
import { usePhotoUrl } from '../../../shared/hooks/usePhotoUrl'
import type { SearchResult } from '../hooks/useNodeSearch'
import styles from '../Graph.module.css'

type Props = {
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchExpanded: boolean
  setSearchExpanded: (next: boolean) => void
  searchResults: SearchResult[]
  currentLayer: Layer
  /** Invoked when a result is clicked. */
  onSelect: (result: SearchResult) => void
}

function SearchResultThumb({ photoPath, photoUpdatedAt }: { photoPath: string | undefined; photoUpdatedAt: string | undefined }) {
  const url = usePhotoUrl(photoPath, photoUpdatedAt)
  if (!url) return null
  return <img src={url} alt="" className={styles.searchResultThumb} />
}

/** Search FAB that expands into an input + results dropdown. The orchestrator
 *  feeds in the query state, results memo, and a callback to act on a click. */
export function GraphSearch({
  searchInputRef,
  searchQuery,
  setSearchQuery,
  searchExpanded,
  setSearchExpanded,
  searchResults,
  currentLayer,
  onSelect,
}: Props) {
  return (
    <>
      <div
        className={clsx(styles.searchWrap, searchExpanded && styles.searchWrapExpanded)}
        aria-hidden={!searchExpanded}
      >
        <div className={styles.searchInputWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('')
                setSearchExpanded(false)
              }
            }}
            placeholder={currentLayer === 'memories' ? 'Find a memory…' : 'Find a person or place…'}
            aria-label="Search nodes by name"
          />
          {searchQuery ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchExpanded(false)}
              aria-label="Hide search"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery ? (
          <ul className={styles.searchResults} role="listbox">
            {searchResults.length === 0 ? (
              <li className={styles.searchEmpty}>No matches</li>
            ) : (
              searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={styles.searchResultItem}
                    onClick={() => {
                      onSelect(r)
                      setSearchQuery('')
                    }}
                  >
                    <SearchResultThumb photoPath={r.photoPath} photoUpdatedAt={r.photoUpdatedAt} />
                    <span className={styles.searchResultName}>{r.name}</span>
                    <span className={styles.searchResultType}>{r.type}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        className={clsx(styles.fab, styles.fabSearch, searchExpanded && styles.fabHidden)}
        onClick={() => setSearchExpanded(true)}
        aria-label="Open search"
        aria-hidden={searchExpanded}
        tabIndex={searchExpanded ? -1 : 0}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="8" cy="8" r="5" />
          <line x1="11.5" y1="11.5" x2="15" y2="15" strokeLinecap="round" />
        </svg>
      </button>
    </>
  )
}
