import type { CSSProperties } from 'react'
import { Handle, Position } from '@xyflow/react'

const CENTER_HANDLE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 'none',
  background: 'transparent',
  opacity: 0,
  pointerEvents: 'none',
}

export const CENTER_SOURCE_HANDLE_ID = 'src-center'
export const CENTER_TARGET_HANDLE_ID = 'tgt-center'

export function NodeEdgeHandles() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        id={CENTER_TARGET_HANDLE_ID}
        style={CENTER_HANDLE_STYLE}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Top}
        id={CENTER_SOURCE_HANDLE_ID}
        style={CENTER_HANDLE_STYLE}
        isConnectable={false}
      />
    </>
  )
}
