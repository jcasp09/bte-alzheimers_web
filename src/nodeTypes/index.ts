import { memo } from 'react'
import { PersonNode } from './PersonNode'

export const NODE_TYPE = { PERSON : 'person' } as const

export const nodeTypes = {
  [NODE_TYPE.PERSON]: memo(PersonNode),
}
