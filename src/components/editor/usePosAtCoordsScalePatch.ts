import { useEffect, useRef } from 'react'

type PmView = {
  posAtCoords: (coords: { left: number; top: number }) => { pos: number; inside: number } | null
  posAtDOM: (node: Node, offset: number) => number
  dom: HTMLElement
  state: {
    selection: { from: number; to: number; anchor: number; head: number }
  }
}

export function findClosestTextPosition(
  view: Pick<PmView, 'dom' | 'posAtDOM'>,
  coords: { left: number; top: number },
): number | null {
  let bestPos: number | null = null
  let bestScore = Infinity
  const walker = document.createTreeWalker(view.dom, NodeFilter.SHOW_TEXT)
  let textNode: Text | null

  while ((textNode = walker.nextNode() as Text | null)) {
    const parent = textNode.parentElement
    if (!parent) continue

    const parentRect = parent.getBoundingClientRect()
    if (coords.top < parentRect.top - parentRect.height / 2
      || coords.top > parentRect.bottom + parentRect.height / 2) continue

    const length = textNode.textContent?.length ?? 0
    const range = document.createRange()

    for (let offset = 0; offset <= length; offset += 1) {
      const characterStart = offset === 0 ? 0 : offset - 1
      const characterEnd = offset === 0 ? Math.min(1, length) : offset
      range.setStart(textNode, characterStart)
      range.setEnd(textNode, characterEnd)

      const caretRect = range.getClientRects()[0] ?? range.getBoundingClientRect()
      const caretY = caretRect.height > 0
        ? (caretRect.top + caretRect.bottom) / 2
        : (parentRect.top + parentRect.bottom) / 2
      const caretX = offset === 0 ? caretRect.left : caretRect.right
      const score = Math.abs(coords.top - caretY) * 10_000
        + Math.abs(coords.left - caretX)

      if (score < bestScore) {
        try {
          bestPos = view.posAtDOM(textNode, offset)
          bestScore = score
        } catch { /* ignore DOM nodes that ProseMirror does not own */ }
      }
    }
  }

  return bestPos
}

/**
 * React Flow viewport 的 CSS transform: scale() 导致 ProseMirror posAtCoords
 * 在 dropCursor 场景下返回偏移位置（预览线偏下）。
 *
 * 根因：posAtCoords 内部依赖 caretFromPoint / elementFromPoint，
 * 在 CSS transform 环境下这两个浏览器 API 的精度下降。
 *
 * 修复：当编辑器 DOM 被缩放时，monkey-patch posAtCoords，
 * 用浏览器返回的真实字符矩形确定最近的字符边界位置。
 * 无缩放时直接走原始逻辑，零侵入。
 */
export function usePosAtCoordsScalePatch(editor: unknown) {
  const originalFnRef = useRef<PmView['posAtCoords'] | null>(null)

  useEffect(() => {
    const pm = (editor as unknown as Record<string, unknown>).prosemirrorView as PmView | undefined
    if (!pm) return

    originalFnRef.current = pm.posAtCoords

    pm.posAtCoords = function (coords: { left: number; top: number }) {
      const original = originalFnRef.current!
      // 每次调用时从 editor 上重新取 prosemirrorView，避免闭包引用失效
      const currentPm = (editor as unknown as Record<string, unknown>).prosemirrorView as PmView | undefined
      if (!currentPm || !currentPm.dom) return original(coords)

      const dom = currentPm.dom
      const rect = dom.getBoundingClientRect()
      const scaleX = rect.width / dom.offsetWidth
      const scaleY = rect.height / dom.offsetHeight

      if (Math.abs(scaleX - 1) < 0.002 && Math.abs(scaleY - 1) < 0.002) {
        return original(coords)
      }

      const bestPos = findClosestTextPosition(currentPm, coords)

      if (bestPos != null) {
        return { pos: bestPos, inside: -1 }
      }

      return original(coords)
    }

    return () => {
      const currentPm = (editor as unknown as Record<string, unknown>).prosemirrorView as PmView | undefined
      if (currentPm && originalFnRef.current) {
        currentPm.posAtCoords = originalFnRef.current
        originalFnRef.current = null
      }
    }
  }, [editor])
}
