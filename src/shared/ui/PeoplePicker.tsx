import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { PlusIcon } from './icons'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import { getInitialsForAvatar } from '../util/initials'
import styles from './PeoplePicker.module.css'

export type PeoplePickerItem = {
  id: string
  name: string
  photoPath?: string
}

type Props = {
  items: PeoplePickerItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  max?: number
  disabled?: boolean
  addLabel?: string
}

function PersonAvatar({
  item,
  size = 40,
  ringClassName,
}: {
  item: PeoplePickerItem
  size?: number
  ringClassName?: string
}) {
  const url = usePhotoUrl(item.photoPath)
  const initials = getInitialsForAvatar(item.name) || '?'
  return (
    <span
      className={clsx(styles.avatar, ringClassName)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" className={styles.avatarImage} />
      ) : (
        <span className={styles.avatarInitials}>{initials}</span>
      )}
    </span>
  )
}

export function PeoplePicker({
  items,
  selectedIds,
  onChange,
  max = 10,
  disabled,
  addLabel = 'Add person',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const handleDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => items.find((it) => it.id === id))
        .filter((it): it is PeoplePickerItem => it != null),
    [items, selectedIds],
  )
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.name.toLowerCase().includes(q))
  }, [items, search])

  const toggle = (id: string) => {
    if (disabled) return
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id))
      return
    }
    if (selectedIds.length >= max) return
    onChange([...selectedIds, id])
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.row}>
        {selectedItems.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.rowItem}
            onClick={() => toggle(p.id)}
            disabled={disabled}
            aria-label={`Remove ${p.name} from this memory`}
            title={`Remove ${p.name}`}
          >
            <PersonAvatar item={p} />
            <span className={styles.removeBadge} aria-hidden="true">×</span>
          </button>
        ))}
        <button
          type="button"
          className={clsx(styles.placeholder, open && styles.placeholderOpen)}
          onClick={() => setOpen((v) => !v)}
          disabled={disabled || (selectedIds.length >= max && !open)}
          aria-label={addLabel}
          aria-expanded={open}
          title={addLabel}
        >
          <PlusIcon size={22} />
        </button>
      </div>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={addLabel}>
          <div className={styles.popoverHeader}>
            <input
              ref={inputRef}
              type="search"
              className={styles.search}
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className={styles.count}>
              {selectedIds.length} / {max}
            </span>
          </div>
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <p className={styles.empty}>No matches.</p>
            ) : (
              filtered.map((it) => {
                const isSelected = selectedSet.has(it.id)
                const atCap = !isSelected && selectedIds.length >= max
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={clsx(styles.tile, isSelected && styles.tileSelected, atCap && styles.tileAtCap)}
                    onClick={() => toggle(it.id)}
                    disabled={disabled || atCap}
                    aria-pressed={isSelected}
                  >
                    <PersonAvatar
                      item={it}
                      size={44}
                      ringClassName={isSelected ? styles.ringSelected : undefined}
                    />
                    <span className={styles.tileName}>{it.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
