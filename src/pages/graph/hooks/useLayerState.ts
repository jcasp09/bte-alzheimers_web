import { useEffect, useState } from 'react'
import {
  DEFAULT_LAYER,
  LAYER_STORAGE_KEY,
  isLayer,
  type Layer,
} from '../../../graph/model/flowConstants'

function readInitialLayer(): Layer {
  if (typeof window === 'undefined') return DEFAULT_LAYER
  try {
    const fromUrl = new URL(window.location.href).searchParams.get('layer')
    if (isLayer(fromUrl)) return fromUrl
  } catch {
    /* fall through to sessionStorage */
  }
  try {
    const stored = window.sessionStorage.getItem(LAYER_STORAGE_KEY)
    return isLayer(stored) ? stored : DEFAULT_LAYER
  } catch {
    return DEFAULT_LAYER
  }
}

/** Owns the active graph layer ("relationships" | "memories"). Reads the
 *  initial value from the URL ?layer= query param, falling back to
 *  per-tab sessionStorage so reloads keep the user where they were. */
export function useLayerState() {
  const [currentLayer, setCurrentLayer] = useState<Layer>(readInitialLayer)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(LAYER_STORAGE_KEY, currentLayer)
    } catch {
      /* sessionStorage unavailable; layer won't persist this session */
    }
  }, [currentLayer])

  return { currentLayer, setCurrentLayer }
}
