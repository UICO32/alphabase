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
  /** 文本注释工具激活态：点击画布空白处放置一个文本注释节点 */
  textToolMode: boolean
  /** 刚创建的文本注释节点 id，用于自动进入编辑态（消费后清空） */
  autoEditAnnoId: string | null
}

export const useFrameInteraction = create<FrameInteractionState>(() => ({
  lassoMode: false,
  lassoRect: null,
  lassoSelectedCardIds: new Set<string>(),
  dragOverFrameId: null,
  textToolMode: false,
  autoEditAnnoId: null,
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

export function enterTextToolMode() {
  useFrameInteraction.setState({ textToolMode: true })
}

export function exitTextToolMode() {
  useFrameInteraction.setState({ textToolMode: false })
}

export function setAutoEditAnnoId(id: string | null) {
  useFrameInteraction.setState({ autoEditAnnoId: id })
}
