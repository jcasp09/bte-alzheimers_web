import { CheckIcon } from './icons'
import styles from './SaveCornerButton.module.css'

type Props = {
  visible?: boolean
  busy?: boolean
  busyLabel?: string
  label?: string
  ariaLabel?: string
}

export function SaveCornerButton({
  visible = true,
  busy,
  busyLabel = 'Saving…',
  label = 'Save',
  ariaLabel = 'Save changes',
}: Props) {
  if (!visible) return null
  return (
    <button
      type="submit"
      className={styles.button}
      disabled={busy}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <CheckIcon size={16} />
      <span>{busy ? busyLabel : label}</span>
    </button>
  )
}
