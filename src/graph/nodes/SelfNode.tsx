import { useAuth } from '../../auth/AuthContext'
import { NodeEdgeHandles } from '../components/NodeEdgeHandles'
import { SELF_NODE_DEFAULT_SIZE } from '../model/dimensions'
import { getInitialsForAvatar } from '../../shared/util/initials'

export function SelfNode() {
  const { user, profile } = useAuth()

  const firstName = profile?.firstName?.trim() ?? ''
  const lastName = profile?.lastName?.trim() ?? ''
  const fullName = [firstName, lastName].filter((s) => s.length > 0).join(' ')
  const displayName = fullName || user?.displayName || user?.email || 'You'
  const photoURL = profile?.photoURL ?? user?.photoURL ?? ''

  const w = SELF_NODE_DEFAULT_SIZE.width
  const h = SELF_NODE_DEFAULT_SIZE.height
  const avatar = Math.round(h * 1.2) // slightly larger ratio than people, since self is the focal point
  const avatarPokeOut = Math.round(avatar * 0.5)
  const textPaddingLeft = Math.max(8, avatar - avatarPokeOut + 10)
  const verticalPad = 8
  const borderRadius = 16
  const fontSize = 16
  const subFont = 11

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        minHeight: h,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          minHeight: h,
          boxSizing: 'border-box',
          borderRadius,
          background: 'var(--color-node-person)',
          border: '3px solid var(--color-accent)',
          boxShadow: '0 0 0 4px var(--color-accent-soft), 0 8px 22px rgba(var(--color-shadow-rgb), 0.18)',
          color: 'var(--color-node-person-text)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 3,
          fontSize,
          textAlign: 'left',
          paddingTop: verticalPad,
          paddingBottom: verticalPad,
          paddingLeft: textPaddingLeft,
          paddingRight: 12,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {displayName}
        </span>
        <span
          style={{
            fontSize: subFont,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          You
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: -avatarPokeOut,
          top: '50%',
          transform: 'translateY(-50%)',
          width: avatar,
          height: avatar,
          borderRadius: '50%',
          backgroundImage: photoURL ? `url(${photoURL})` : undefined,
          backgroundColor: photoURL ? undefined : 'var(--color-accent-soft)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '3px solid var(--color-accent)',
          boxShadow: '0 0 0 4px var(--color-accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-accent)',
          fontSize: Math.round(avatar * 0.4),
          fontWeight: 700,
          userSelect: 'none',
          zIndex: 1,
          boxSizing: 'border-box',
        }}
        aria-label={`${displayName} (you) avatar`}
      >
        {photoURL ? null : getInitialsForAvatar(displayName) || 'You'}
      </div>

      <NodeEdgeHandles />
    </div>
  )
}
