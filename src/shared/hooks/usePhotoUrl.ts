import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../../firebase/storage'

const photoUrlCache = new Map<string, string>()

function cacheKey(photoPath: string, version: string | undefined): string {
  return version ? `${photoPath}|${version}` : photoPath
}

/** Resolves a Firebase Storage path into a download URL.
 *  - Returns the cached URL synchronously when present.
 *  - Returns null while the async fetch is in flight (or when no path is given).
 *  - Re-renders the component when the fetch completes, populating the cache.
 *  - Network failure is silent: the cache stays empty so callers fall back to no image.
 *  - Pass `version` (e.g. `photoUpdatedAt`) to bust the cache when the object at
 *    a stable path is replaced; otherwise the cached URL would shadow the new image. */
export function usePhotoUrl(
  photoPath: string | undefined,
  version?: string | undefined,
): string | null {
  // The cache is the source of truth; this state is only a re-render trigger.
  const [, forceRender] = useState(0)
  const key = photoPath ? cacheKey(photoPath, version) : null
  const url = key ? photoUrlCache.get(key) ?? null : null

  useEffect(() => {
    if (!photoPath || !key || photoUrlCache.has(key)) return
    let cancelled = false
    void getDownloadURL(ref(storage, photoPath))
      .then((u) => {
        if (cancelled) return
        photoUrlCache.set(key, u)
        forceRender((c) => c + 1)
      })
      .catch(() => { /* leaves the cache empty so caller falls back */ })
    return () => { cancelled = true }
  }, [photoPath, key])

  return url
}
