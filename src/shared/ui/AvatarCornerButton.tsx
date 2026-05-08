import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './AvatarCornerButton.module.css'

type Props = {
  icon: ReactNode
  ariaLabel: string
  onClick: () => void
  disabled?: boolean
  /** Visual emphasis: 'default' is muted, 'reset' draws a touch more attention. */
  variant?: 'default' | 'reset'
}

export function AvatarCornerButton({
  icon,
  ariaLabel,
  onClick,
  disabled,
  variant = 'default',
}: Props) {
  return (
    <button
      type="button"
      className={clsx(styles.button, variant === 'reset' && styles.reset)}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {icon}
    </button>
  )
}
