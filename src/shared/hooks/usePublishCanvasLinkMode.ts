import { useEffect, useMemo } from 'react'

export type CanvasLinkMode = {
  eligibleTypes: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
} | null

type Publish = (mode: CanvasLinkMode) => void

export function usePublishCanvasLinkMode(
  publish: Publish,
  eligibleTypes: ReadonlySet<string>,
  selectedIds: ReadonlyArray<string> | ReadonlySet<string>,
  onToggle: (nodeId: string) => void,
): void {
  const selectedIdsSet = useMemo(
    () => (selectedIds instanceof Set ? selectedIds : new Set(selectedIds)),
    [selectedIds],
  )

  useEffect(() => {
    publish({ eligibleTypes, selectedIds: selectedIdsSet, onToggle })
  }, [eligibleTypes, selectedIdsSet, onToggle, publish])

  useEffect(() => {
    return () => publish(null)
  }, [publish])
}
