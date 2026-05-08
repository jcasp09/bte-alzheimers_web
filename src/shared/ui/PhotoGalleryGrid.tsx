import { useRef } from 'react'
import clsx from 'clsx'
import { PlusIcon, StarIcon } from './icons'
import styles from './PhotoGalleryGrid.module.css'

type Props = {
  paths: string[]
  urls: Record<string, string>
  max: number
  accept?: string
  disabled?: boolean
  uploading?: boolean
  removingPath?: string | null
  onAddPhoto: (file: File) => void
  onRemovePhoto: (path: string) => void
  onSetCover?: (path: string) => void
}

function computeVisibleCells(count: number, max: number): number {
  if (count >= max) return max
  if (count === 0) return Math.min(3, max)
  const existingRows = Math.ceil(count / 3)
  const rows = count % 3 === 0 ? existingRows + 1 : existingRows
  return Math.min(rows * 3, max)
}

export function PhotoGalleryGrid({
  paths,
  urls,
  max,
  accept = 'image/jpeg,image/png',
  disabled,
  uploading,
  removingPath,
  onAddPhoto,
  onRemovePhoto,
  onSetCover,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const visibleCells = computeVisibleCells(paths.length, max)
  const addTilesShown = visibleCells > paths.length

  const triggerPicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const cells: Array<{ kind: 'photo'; path: string } | { kind: 'add' }> = []
  for (const p of paths) cells.push({ kind: 'photo', path: p })
  for (let i = paths.length; i < visibleCells; i++) cells.push({ kind: 'add' })

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {cells.map((cell, i) => {
          if (cell.kind === 'photo') {
            const url = urls[cell.path]
            const isRemoving = removingPath === cell.path
            const isCover = i === 0
            return (
              <div key={cell.path} className={styles.tile}>
                {url ? (
                  <img src={url} alt="" className={styles.image} />
                ) : (
                  <span className={styles.loading}>Loading…</span>
                )}
                {onSetCover ? (
                  <button
                    type="button"
                    className={styles.coverButton}
                    disabled={disabled || isCover}
                    onClick={() => onSetCover(cell.path)}
                    aria-label={isCover ? 'Cover photo' : 'Set as cover photo'}
                    aria-pressed={isCover}
                    title={isCover ? 'Cover photo' : 'Set as cover photo'}
                  >
                    <StarIcon size={14} filled={isCover} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.removeButton}
                  disabled={isRemoving || disabled}
                  onClick={() => onRemovePhoto(cell.path)}
                  aria-label="Remove photo"
                  title="Remove photo"
                >
                  {isRemoving ? '…' : '✕'}
                </button>
              </div>
            )
          }
          return (
            <button
              key={`add-${i}`}
              type="button"
              className={clsx(styles.tile, styles.addTile)}
              onClick={triggerPicker}
              disabled={disabled || uploading}
              aria-label="Add photo"
              title="Add photo"
            >
              <PlusIcon size={26} />
            </button>
          )
        })}
      </div>

      {addTilesShown ? (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className={styles.fileInput}
          disabled={disabled || uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onAddPhoto(f)
          }}
        />
      ) : null}
    </div>
  )
}
