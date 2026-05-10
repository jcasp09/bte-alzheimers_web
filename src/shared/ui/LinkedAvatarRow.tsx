import { XIcon } from './icons'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import { getInitialsForAvatar } from '../util/initials'
import styles from './LinkedAvatarRow.module.css'

export type LinkedAvatarItem = {
  id: string
  name: string
  photoPath?: string
}

type Props = {
  items: LinkedAvatarItem[]
  mode?: 'remove' | 'focus'
  onItemClick: (id: string) => void
  disabled?: boolean
}

function ItemAvatar({ item, size = 36 }: { item: LinkedAvatarItem; size?: number }) {
  const url = usePhotoUrl(item.photoPath)
  const initials = getInitialsForAvatar(item.name) || '?'
  return (
    <span
      className={styles.avatar}
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

export function LinkedAvatarRow({
  items,
  mode = 'focus',
  onItemClick,
  disabled,
}: Props) {
  if (items.length === 0) return null
  const isRemove = mode === 'remove'
  return (
    <div className={styles.row}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={styles.tile}
          onClick={() => onItemClick(it.id)}
          disabled={disabled}
          aria-label={isRemove ? `Remove ${it.name}` : `Focus ${it.name}`}
          title={isRemove ? `Remove ${it.name}` : it.name}
        >
          <span className={styles.avatarWrap}>
            <ItemAvatar item={it} />
            {isRemove ? (
              <span className={styles.removeBadge} aria-hidden="true"><XIcon size={10} /></span>
            ) : null}
          </span>
          <span className={styles.name}>{it.name}</span>
        </button>
      ))}
    </div>
  )
}
