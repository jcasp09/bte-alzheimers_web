import type { SVGProps } from 'react'

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function applyDefaults({ size = 16, width, height, ...rest }: IconProps) {
  return { width: width ?? size, height: height ?? size, ...baseProps, ...rest }
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...applyDefaults(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...applyDefaults(props)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...applyDefaults(props)}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...applyDefaults(props)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <svg {...applyDefaults(props)}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function EqualsIcon(props: IconProps) {
  return (
    <svg {...applyDefaults(props)}>
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="5" y1="15" x2="19" y2="15" />
    </svg>
  )
}

export function StarIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  const styled = applyDefaults(props)
  return (
    <svg {...styled} fill={filled ? 'currentColor' : 'none'}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...applyDefaults(props)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

