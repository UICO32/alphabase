import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useCardStore, type GlobalCard } from '../../stores/cardStore'
import { useViewStore } from '../../stores/viewStore'
import { registerEditorHandle, clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import { findTextOffsetAtPoint } from '../../utils/caretScan'
import type { BlockNoteEditorHandle } from '../editor/BlockNoteEditor'

type UpdateCard = (id: string, props: Partial<GlobalCard>) => void

export interface EditorFocusIntent {
  x: number
  y: number
  textOffset?: number
}

export interface BeginEditingOptions extends EditorFocusIntent {
  /** 点击时捕获的 preview 元素；textOffset 将延迟到下一帧对其计算，避免同步阻塞 */
  previewElement?: HTMLElement | null
  /** 点击所属的节点容器（编辑态切换后用于回退查找 CardEditorEntry 的 preview） */
  nodeElement?: HTMLElement | null
}

interface UseCardNodeEditingArgs {
  cardId: string
  selected: boolean
  updateCard: UpdateCard
}

export function takeEditorFocusIntent(
  ref: { current: EditorFocusIntent | null },
) {
  const intent = ref.current
  ref.current = null
  return intent
}

export function useCardNodeEditing({
  cardId,
  selected,
  updateCard,
}: UseCardNodeEditingArgs) {
  const [isEditing, setIsEditing] = useState(false)
  const editorRef = useRef<BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<EditorFocusIntent | null>(null)
  const textOffsetRafRef = useRef<number | null>(null)

  const isAutoEdit = useViewStore((s) => s.autoEditCardId === cardId)

  useEffect(() => {
    if (isAutoEdit) setIsEditing(true)
  }, [isAutoEdit])

  // 卸载时取消未完成的 textOffset 计算
  useEffect(() => () => {
    if (textOffsetRafRef.current !== null) cancelAnimationFrame(textOffsetRafRef.current)
  }, [])

  useEffect(() => {
    registerEditorHandle(cardId, editorRef.current ?? null)
    return () => registerEditorHandle(cardId, null)
  }, [cardId, isEditing, selected])

  const beginEditingAt = useCallback((coords?: BeginEditingOptions) => {
    const x = coords?.x ?? 0
    const y = coords?.y ?? 0
    // 立即声明编辑意图：让其他卡（尤其挂载中的编辑器）知道焦点归属已变化，
    // 避免它们 mount 完成后抢回焦点（表现为点 B 却回到 A，A 显示编辑态黑边框）。
    useViewStore.getState().setEditingCardId(cardId)
    // 已有现成 textOffset（调用方同步算好）直接使用
    if (coords?.textOffset != null) {
      clickCoordsRef.current = { x, y, textOffset: coords.textOffset }
      setIsEditing(true)
      return
    }
    // 先立即进入编辑态，textOffset 延迟到下一帧计算：
    // 长卡片的逐字符 layout 扫描（getClientRects）可达数十毫秒，
    // 同步执行会让点击瞬间冻结；而编辑器挂载（>1 帧）后才消费该值，
    // rAF 内算完绰绰有余。
    clickCoordsRef.current = { x, y }
    setIsEditing(true)
    const previewEl = coords?.previewElement
    const nodeEl = coords?.nodeElement
    if (!previewEl && !nodeEl) return
    if (textOffsetRafRef.current !== null) cancelAnimationFrame(textOffsetRafRef.current)
    textOffsetRafRef.current = requestAnimationFrame(() => {
      textOffsetRafRef.current = null
      // React 在点击事件后同步切换编辑态，原 preview 已卸载；
      // 回退到 CardEditorEntry 挂载的 preview（内容与点击时一致）。
      // 若两者都不可用（初始化极快、preview 已隐藏）则跳过，交给坐标定位兜底。
      const root = previewEl?.isConnected
        ? previewEl
        : (nodeEl?.querySelector<HTMLElement>('.card-editor-entry__preview') ?? null)
      if (!root) return
      const textOffset = findTextOffsetAtPoint(root, x, y)
      clickCoordsRef.current = { x, y, textOffset }
    })
  }, [cardId])

  const handleContentChange = useCallback(
    (content: string) => {
      clearProseMirrorSuppression(cardId)
      updateCard(cardId, { content })
      // User typed something — this autoEdit card is now confirmed, won't be auto-deleted
      if (useViewStore.getState().autoEditCardId === cardId) {
        useViewStore.getState().setAutoEditCardId(null)
      }
    },
    [cardId, updateCard],
  )

  const handleEditorFocus = useCallback(() => {
    const content = useCardStore.getState().cards[cardId]?.content
    if (content) useEditorHistoryStore.getState().recordSnapshot(cardId, content)
    useViewStore.getState().setEditingCardId(cardId)
  }, [cardId])

  const handleEditorBlur = useCallback(() => {
    const content = useCardStore.getState().cards[cardId]?.content
    if (content) useEditorHistoryStore.getState().recordSnapshot(cardId, content)
    setIsEditing(false)
    // 当前编辑卡失焦 → 清空全局编辑卡标记，让 zIndex 恢复、其他挂载中的编辑器
    // 也能感知焦点归属已失效
    if (useViewStore.getState().editingCardId === cardId) {
      useViewStore.getState().setEditingCardId(null)
    }
  }, [cardId])

  const prepareEditorForReveal = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    // 挂载完成时校验焦点归属：若用户已点击/编辑其他卡（editingCardId 已切换），
    // 本卡不再抢回焦点——否则表现为"点 B 却回到 A，A 显示编辑态黑色边框"。
    // editingCardId 为 null（如 autoEdit 新卡）时放行。
    const activeEditingId = useViewStore.getState().editingCardId
    if (activeEditingId !== null && activeEditingId !== cardId) return
    const coords = takeEditorFocusIntent(clickCoordsRef)
    if (coords) editor.focusAtCoords(coords)
    else editor.focus()
  }, [cardId])

  return {
    isEditing,
    editorRef,
    beginEditingAt,
    prepareEditorForReveal,
    handleContentChange,
    handleEditorFocus,
    handleEditorBlur,
  }
}
