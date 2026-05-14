import { useState } from 'react'
import type { XY } from '../../../graph/model/flowConstants'

/** A node selected from the canvas, surfaced in the NodeInfoModal side panel. */
export type SelectedNode = {
  id: string
  name: string
  type: string
  relationship?: string
  email?: string
  phone?: string
  address?: string
  photoPath?: string
  photoUpdatedAt?: string
  width?: number
  height?: number
  ringTier?: number | null
}

/** An edge selected from the canvas, surfaced in the EdgeInfoModal side panel. */
export type SelectedEdge = {
  id: string
  sourceId: string
  targetId: string
  sourceName: string
  targetName: string
  sourcePhotoPath?: string
  targetPhotoPath?: string
  label?: string
}

/** Which Add* panel is open in the side slot. */
export type AddPanelKind = 'addPerson' | 'addPlace' | 'addConnection' | 'addMemory' | 'addTask'

/** Single discriminated state for the side-panel slot. */
type SidePanelState =
  | { kind: 'none' }
  | { kind: 'add'; panel: AddPanelKind; position: XY | null }
  | { kind: 'nodeInfo'; node: SelectedNode }
  | { kind: 'edgeInfo'; edge: SelectedEdge }
  | { kind: 'memoryInfo'; memoryId: string }
  | { kind: 'taskInfo'; taskId: string }
  | { kind: 'selfInfo' }

/** Owns the canvas side-panel slot and enforces mutual exclusion across
 *  the panels that can occupy it. */
export function useGraphSidePanel() {
  const [state, setState] = useState<SidePanelState>({ kind: 'none' })

  return {
    openPanel: state.kind === 'add' ? state.panel : null,
    selectedNode: state.kind === 'nodeInfo' ? state.node : null,
    selectedEdge: state.kind === 'edgeInfo' ? state.edge : null,
    memoryInfoId: state.kind === 'memoryInfo' ? state.memoryId : null,
    taskInfoId: state.kind === 'taskInfo' ? state.taskId : null,
    pendingNodePosition: state.kind === 'add' ? state.position : null,
    isSelfInfoOpen: state.kind === 'selfInfo',
    isSidePanelOpen:
      state.kind === 'nodeInfo' ||
      state.kind === 'edgeInfo' ||
      state.kind === 'memoryInfo' ||
      state.kind === 'taskInfo' ||
      state.kind === 'selfInfo' ||
      state.kind === 'add',
    close: () => setState({ kind: 'none' }),
    openAddPanel: (panel: AddPanelKind, position: XY | null = null) =>
      setState({ kind: 'add', panel, position }),
    openNodeInfo: (node: SelectedNode) => setState({ kind: 'nodeInfo', node }),
    openEdgeInfo: (edge: SelectedEdge) => setState({ kind: 'edgeInfo', edge }),
    openMemoryInfo: (memoryId: string) => setState({ kind: 'memoryInfo', memoryId }),
    openTaskInfo: (taskId: string) => setState({ kind: 'taskInfo', taskId }),
    openSelfInfo: () => setState({ kind: 'selfInfo' }),
    /** Click-to-toggle for dock buttons: clicking the same panel twice closes it. */
    togglePanel: (panel: AddPanelKind) =>
      setState((prev) =>
        prev.kind === 'add' && prev.panel === panel
          ? { kind: 'none' }
          : { kind: 'add', panel, position: null },
      ),
  }
}
