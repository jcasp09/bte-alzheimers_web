import { useMemo, useState } from 'react'
import clsx from 'clsx'
import styles from './MultiEntityPicker.module.css'

export type PickerItem = { id: string; name: string }

type MultiEntityPickerProps = {
  label: string
  max: number
  items: PickerItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function MultiEntityPicker({
  label,
  max,
  items,
  selectedIds,
  onChange,
  disabled,
}: MultiEntityPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(true)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.name.toLowerCase().includes(q))
  }, [items, search])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const addId = (id: string) => {
    if (disabled) return
    if (selectedIds.includes(id)) return
    if (selectedIds.length >= max) return
    onChange([...selectedIds, id])
  }

  const removeId = (id: string) => {
    if (disabled) return
    onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <div className={styles.section}>
      <p className={styles.label}>{label}</p>
      <p className={styles.helper}>
        {selectedIds.length} / {max} selected — search or pick from the list
      </p>
      <input
        type="search"
        placeholder="Search…"
        className={styles.search}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
      />
      {selectedIds.length > 0 && (
        <div className={styles.chips}>
          {selectedIds.map((id) => {
            const name = items.find((i) => i.id === id)?.name ?? id
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => removeId(id)}
                className={styles.chip}
              >
                {name} ×
              </button>
            )
          })}
        </div>
      )}
      {open && (
        <ul className={styles.list}>
          {filtered.length === 0 ? (
            <li className={styles.empty}>No matches.</li>
          ) : (
            filtered.map((it) => {
              const isAdded = selectedSet.has(it.id)
              const atCap = selectedIds.length >= max
              const cannotAdd = isAdded || atCap
              return (
                <li
                  key={it.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!cannotAdd) addId(it.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!cannotAdd) addId(it.id)
                    }
                  }}
                  className={clsx(styles.listItem, isAdded && styles.listItemAdded, atCap && !isAdded && styles.listItemInactive)}
                >
                  {it.name}
                  {isAdded ? ' (added)' : ''}
                </li>
              )
            })
          )}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={styles.toggle}
        disabled={disabled}
      >
        {open ? 'Hide list' : 'Show list'}
      </button>
    </div>
  )
}
