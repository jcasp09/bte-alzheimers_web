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
  const avatar = 92
  const pad = 6
  const gap = 12
  const borderRadius = 14
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          fontSize,
          textAlign: 'left',
          padding: pad,
          gap,
        }}
      >
        <div
          style={{
            width: avatar,
            height: avatar,
            borderRadius: '9999px',
            backgroundImage: photoURL ? `url(${photoURL})` : undefined,
            backgroundColor: photoURL ? undefined : 'var(--color-accent-soft)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '3px solid var(--color-accent)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-accent)',
            fontSize: Math.round(avatar * 0.4),
            fontWeight: 700,
            userSelect: 'none',
          }}
          aria-label={`${displayName} (you) avatar`}
        >
          {photoURL ? null : getInitialsForAvatar(displayName) || 'You'}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            overflow: 'hidden',
            minWidth: 0,
            flex: 1,
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
      </div>
      <NodeEdgeHandles />
    </div>
  )
}
