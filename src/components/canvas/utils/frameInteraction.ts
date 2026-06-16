import { create } from 'zustand'

export interface LassoRect {
  x: number
  y: number
  width: number
  height: number
}

interface FrameInteractionState {
  lassoMode: boolean
  lassoRect: LassoRect | null
  lassoSelectedCardIds: Set<string>
  dragOverFrameId: string | null
}

export const useFrameInteraction = create<FrameInteractionState>(() => ({
  lassoMode: false,
  lassoRect: null,
  lassoSelectedCardIds: new Set<string>(),
  dragOverFrameId: null,
}))

export function enterLassoMode() {
  useFrameInteraction.setState({ lassoMode: true, lassoRect: null, lassoSelectedCardIds: new Set() })
}

export function exitLassoMode() {
  useFrameInteraction.setState({ lassoMode: false, lassoRect: null, lassoSelectedCardIds: new Set() })
}

export function setLassoRect(rect: LassoRect | null) {
  useFrameInteraction.setState({ lassoRect: rect })
}

export function setLassoSelectedCardIds(ids: Set<string>) {
  useFrameInteraction.setState({ lassoSelectedCardIds: ids })
}

export function setDragOverFrameId(id: string | null) {
  useFrameInteraction.setState({ dragOverFrameId: id })
}
