import { memo } from 'react'
import { PersonNode } from './PersonNode'
import { PlaceNode } from './PlaceNode'
import { TaskNode } from './TaskNode'

export const NODE_TYPE = { PERSON: 'person', PLACE: 'place', TASK: 'task' } as const

export const nodeTypes = {
  [NODE_TYPE.PERSON]: memo(PersonNode),
  [NODE_TYPE.PLACE]: memo(PlaceNode),
  [NODE_TYPE.TASK]: memo(TaskNode),
}
