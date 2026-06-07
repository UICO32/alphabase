import type { Node, ReactFlowInstance } from '@xyflow/react'

interface AlignmentToolbarProps {
  selectedNodes: Node[]
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  onApplyAlignment: (updates: Map<string, { x: number; y: number }>) => void
  isDraggingNode: boolean
}

export function AlignmentToolbar(_props: AlignmentToolbarProps) {
  return null
}