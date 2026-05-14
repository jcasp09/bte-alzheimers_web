import { memo } from 'react'
import { AnchorNode } from './AnchorNode'
import { GroupNode } from './GroupNode'
import { MemoryNode } from './MemoryNode'
import { PersonNode } from './PersonNode'
import { PlaceNode } from './PlaceNode'
import { SelfNode } from './SelfNode'
import { RingGuideNode } from './RingGuideNode'
import { RING_GUIDE_NODE_TYPE } from '../model/ringLayout'

export const NODE_TYPE = { PERSON: 'person', PLACE: 'place', GROUP: 'group', ANCHOR: 'anchor', MEMORY: 'memory', SELF: 'self' } as const

export const nodeTypes = {
  [NODE_TYPE.PERSON]: memo(PersonNode),
  [NODE_TYPE.PLACE]: memo(PlaceNode),
  [NODE_TYPE.GROUP]: memo(GroupNode),
  [NODE_TYPE.ANCHOR]: memo(AnchorNode),
  [NODE_TYPE.MEMORY]: memo(MemoryNode),
  [NODE_TYPE.SELF]: memo(SelfNode),
  [RING_GUIDE_NODE_TYPE]: memo(RingGuideNode),
}
