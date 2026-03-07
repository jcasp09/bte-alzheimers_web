import { memo } from 'react'
import { PersonNode } from './PersonNode'
import { PlaceNode } from './PlaceNode'

export const NODE_TYPE = { PERSON: 'person', PLACE: 'place' } as const

export const nodeTypes = {
  [NODE_TYPE.PERSON]: memo(PersonNode),
  [NODE_TYPE.PLACE]: memo(PlaceNode),
}
