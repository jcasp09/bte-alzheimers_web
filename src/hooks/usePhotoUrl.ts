import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../services/storage'

const photoUrlCache = new Map<string, string>()

/** Resolves a Firebase Storage path into a download URL.
 *  - Returns the cached URL synchronously when present.
 *  - Returns null while the async fetch is in flight (or when no path is given).
 *  - Re-renders the component when the fetch completes, populating the cache.
 *  - Network failure is silent: the cache stays empty so callers fall back to no image. */
export function usePhotoUrl(photoPath: string | undefined): string | null {
  // The cache is the source of truth; this state is only a re-render trigger.
  const [, forceRender] = useState(0)
  const url = photoPath ? photoUrlCache.get(photoPath) ?? null : null

  useEffect(() => {
    if (!photoPath || photoUrlCache.has(photoPath)) return
    let cancelled = false
    void getDownloadURL(ref(storage, photoPath))
      .then((u) => {
        if (cancelled) return
        photoUrlCache.set(photoPath, u)
        forceRender((c) => c + 1)
      })
      .catch(() => { /* leaves the cache empty so caller falls back */ })
    return () => { cancelled = true }
  }, [photoPath])

  return url
}
