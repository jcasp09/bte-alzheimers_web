/** Shared constants and types for the React Flow canvas. */

const GRAPH_HALF_EXTENT = 4000

/** Hard cap on how far the canvas can pan or how far nodes can be dragged. */
export const GRAPH_TRANSLATE_EXTENT: [[number, number], [number, number]] = [
  [-GRAPH_HALF_EXTENT, -GRAPH_HALF_EXTENT],
  [GRAPH_HALF_EXTENT, GRAPH_HALF_EXTENT],
]

/** dataTransfer MIME type used for dock drag-to-place. The payload is the node
 *  kind ("person" | "place" | "group" | "moment"). */
export const DOCK_NODE_DND_TYPE = 'application/x-memoryjog-dock-node'

/** Imperative handle exposed from DefaultFlow so the parent can drive viewport
 *  actions like centering on a node from search. */
export type DefaultFlowHandle = {
  focusNode: (nodeId: string) => void
}
