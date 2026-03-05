import { memo } from 'react'
import { ImageNode } from './ImageNode'

export const NODE_TYPE = { IMAGE: 'image' } as const

export const nodeTypes = {
  [NODE_TYPE.IMAGE]: memo(ImageNode),
}
