/**
 * 主题栏拖拽置入状态（画布 useCanvasDrag ↔ TopicBar 共享）：
 * - useCanvasDrag 拖动卡片/frame 时，检测指针是否命中主题栏展开面板 → setHovering
 * - TopicBar 订阅 hovering 显示放置高亮；setQuestionId 暴露"当前问题"供置入归属
 */
let hovering = false
let currentQuestionId: string | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

export const topicDropState = {
  isHovering: () => hovering,
  setHovering(v: boolean) {
    if (hovering !== v) {
      hovering = v
      notify()
    }
  },
  getQuestionId: () => currentQuestionId,
  setQuestionId(id: string | null) {
    if (currentQuestionId !== id) {
      currentQuestionId = id
      notify()
    }
  },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  /** 切换画布/收起面板时重置 */
  reset() {
    hovering = false
    currentQuestionId = null
    notify()
  },
}

/** 命中检测：指针坐标是否落在主题栏展开面板（data-topic-drop）区域内 */
export function isOverTopicBar(clientX: number, clientY: number): boolean {
  // 用 boundingRect 坐标判断而非 elementFromPoint：
  // 拖动中节点会跟随鼠标并遮挡面板，elementFromPoint 会命中节点导致误判
  const el = document.querySelector('[data-topic-drop]')
  if (!el) return false
  const r = el.getBoundingClientRect()
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
}
