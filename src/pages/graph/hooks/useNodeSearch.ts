import { useMemo, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { Layer } from '../../../graph/model/flowConstants'
import type { MemoryDoc } from '../../../memories/data/memories'
import { typePriority } from '../lib/nodeMappers'

export type SearchResult = {
  id: string
  name: string
  type: string
  photoPath: string | undefined
  photoUpdatedAt: string | undefined
}

/** Top-of-canvas search. Memories layer searches memory titles + descriptions;
 *  relationships layer searches person/place names. Returns up to 8 sorted hits. */
export function useNodeSearch(
  nodes: Node[],
  memories: MemoryDoc[],
  currentLayer: Layer,
) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const searchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const all: SearchResult[] = []

    if (currentLayer === 'memories') {
      // Memories layer searches memories only match on title OR description
      // so a vague memory ("hospital", "wedding") still finds the right card.
      for (const m of memories) {
        const title = m.title.trim().length > 0 ? m.title : m.occurredOn
        const haystack = `${title}\n${m.description}`.toLowerCase()
        if (haystack.includes(q)) {
          all.push({ id: m.id, name: title, type: 'memory', photoPath: m.photoPaths[0], photoUpdatedAt: undefined })
        }
      }
    } else {
      // Relationships layer searches people and places.
      for (const n of nodes) {
        if (n.type !== 'person' && n.type !== 'place') continue
        const name = typeof n.data?.name === 'string' ? n.data.name : ''
        if (!name) continue
        if (name.toLowerCase().includes(q)) {
          const photoPath = typeof n.data?.photoPath === 'string' ? n.data.photoPath : undefined
          const photoUpdatedAt = typeof n.data?.photoUpdatedAt === 'string' ? n.data.photoUpdatedAt : undefined
          all.push({ id: n.id, name, type: n.type, photoPath, photoUpdatedAt })
        }
      }
    }

    all.sort((a, b) => {
      const pa = typePriority(a.type, currentLayer)
      const pb = typePriority(b.type, currentLayer)
      if (pa !== pb) return pa - pb
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })
    return all.slice(0, 8)
  }, [nodes, memories, currentLayer, searchQuery])

  return {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    searchInputRef,
    searchResults,
  }
}
