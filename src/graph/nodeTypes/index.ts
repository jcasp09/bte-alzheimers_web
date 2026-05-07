import { memo } from 'react'
import { AnchorNode } from './AnchorNode'
import { GroupNode } from './GroupNode'
import { PersonNode } from './PersonNode'
import { PlaceNode } from './PlaceNode'

export const NODE_TYPE = { PERSON: 'person', PLACE: 'place', GROUP: 'group', ANCHOR: 'anchor' } as const

export const nodeTypes = {
  [NODE_TYPE.PERSON]: memo(PersonNode),
  [NODE_TYPE.PLACE]: memo(PlaceNode),
  [NODE_TYPE.GROUP]: memo(GroupNode),
  [NODE_TYPE.ANCHOR]: memo(AnchorNode),
}
