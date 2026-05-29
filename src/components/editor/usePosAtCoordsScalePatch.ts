import { useEffect, useRef } from 'react'
import type { EditorState } from '@tiptap/pm/state'
import type { Node as PmNode } from '@tiptap/pm/model'

type PmView = {
  posAtCoords: (coords: { left: number; top: number }) => { pos: number; inside: number } | null
  dom: HTMLElement
  state: EditorState
  nodeDOM: (pos: number) => HTMLElement | null
}

/**
 * React Flow viewport 的 CSS transform: scale() 导致 ProseMirror posAtCoords
 * 在 dropCursor 场景下返回偏移位置（预览线偏下）。
 *
 * 根因：posAtCoords 内部依赖 caretFromPoint / elementFromPoint，
 * 在 CSS transform 环境下这两个浏览器 API 的精度下降。
 *
 * 修复：当编辑器 DOM 被缩放时，monkey-patch posAtCoords，
 * 用布局坐标遍历 block 子元素确定最近的块边界位置。
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

      const layoutY = (coords.top - rect.top) / scaleY
      let bestPos: number | null = null
      let bestDist = Infinity

      const state = currentPm.state
      if (!state) return original(coords)

      state.doc.descendants((node: PmNode, pos: number) => {
        if (!node.isBlock) return true
        try {
          const nodeDom = currentPm.nodeDOM(pos) as HTMLElement | null
          if (!nodeDom) return true
          const nodeRect = nodeDom.getBoundingClientRect()
          const nodeLayoutBottom = (nodeRect.bottom - rect.top) / scaleY
          const nodeLayoutTop = (nodeRect.top - rect.top) / scaleY

          const distBottom = Math.abs(layoutY - nodeLayoutBottom)
          const distTop = Math.abs(layoutY - nodeLayoutTop)

          if (distBottom < bestDist) {
            bestDist = distBottom
            bestPos = pos + node.nodeSize
          }
          if (distTop < bestDist) {
            bestDist = distTop
            bestPos = pos
          }
        } catch { return true }
        return true
      })

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