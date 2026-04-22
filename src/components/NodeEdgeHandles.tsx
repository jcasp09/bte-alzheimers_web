import { Handle, Position } from '@xyflow/react'

const SIDES: { position: Position; suffix: 'top' | 'right' | 'bottom' | 'left' }[] = [
  { position: Position.Top, suffix: 'top' },
  { position: Position.Right, suffix: 'right' },
  { position: Position.Bottom, suffix: 'bottom' },
  { position: Position.Left, suffix: 'left' },
]

/**
 * Four sides × (source + target) so users can drag from any outgoing side to any incoming side.
 */
export function NodeEdgeHandles() {
  return (
    <>
      {SIDES.flatMap(({ position, suffix }) => [
        <Handle
          key={`tgt-${suffix}`}
          type="target"
          position={position}
          id={`tgt-${suffix}`}
        />,
        <Handle
          key={`src-${suffix}`}
          type="source"
          position={position}
          id={`src-${suffix}`}
        />,
      ])}
    </>
  )
}
