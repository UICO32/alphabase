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
  /**
   * 正在拖拽缩放手柄的 Frame id。
   * 缩放西/北边会移动 Frame 原点，useFrameSync 会把“原点变化”当成拖动 Frame 而平移子卡；
   * 缩放期间必须跳过这次平移，子卡位置由 FrameNode 的缩放逻辑自己维护。
   */
  resizingFrameId: string | null
}

export const useFrameInteraction = create<FrameInteractionState>(() => ({
  lassoMode: false,
  lassoRect: null,
  lassoSelectedCardIds: new Set<string>(),
  dragOverFrameId: null,
  textToolMode: false,
  autoEditAnnoId: null,
  resizingFrameId: null,
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

export function setResizingFrameId(id: string | null) {
  useFrameInteraction.setState({ resizingFrameId: id })
}
