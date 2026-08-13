import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useCardStore, type GlobalCard } from '../../stores/cardStore'
import { useViewStore } from '../../stores/viewStore'
import { registerEditorHandle, clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import { getNativeTextOffsetAtPoint } from '../../utils/caretScan'
import type { BlockNoteEditorHandle } from '../editor/BlockNoteEditor'

type UpdateCard = (id: string, props: Partial<GlobalCard>) => void

export interface EditorFocusIntent {
  x: number
  y: number
  textOffset?: number
}

export interface BeginEditingOptions extends EditorFocusIntent {
  /** 点击时仍可见的 preview 元素，用浏览器原生命中测试获取光标位置 */
  previewElement?: HTMLElement | null
}

interface UseCardNodeEditingArgs {
  cardId: string
  selected: boolean
  updateCard: UpdateCard
  /** 取消其他节点选中用（编辑聚焦 = 单选语义） */
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void
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
  setNodes,
}: UseCardNodeEditingArgs) {
  const [isEditing, setIsEditing] = useState(false)
  const editorRef = useRef<BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<EditorFocusIntent | null>(null)

  const isAutoEdit = useViewStore((s) => s.autoEditCardId === cardId)

  useEffect(() => {
    if (isAutoEdit) setIsEditing(true)
  }, [isAutoEdit])

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
    // preview 尚未被编辑态替换时直接使用浏览器的 caret 命中测试。
    // 该路径不做逐字符 getClientRects，避免把布局扫描塞进点击后的首帧。
    const textOffset = coords?.textOffset
      ?? (coords?.previewElement
        ? getNativeTextOffsetAtPoint(coords.previewElement, x, y)
        : undefined)
    clickCoordsRef.current = textOffset == null ? { x, y } : { x, y, textOffset }
    setIsEditing(true)
  }, [cardId])

  const handleContentChange = useCallback(
    (content: string) => {
      clearProseMirrorSuppression(cardId)
      updateCard(cardId, { content })
    },
    [cardId, updateCard],
  )

  const handleUserInput = useCallback(() => {
    useViewStore.getState().markAutoEditCardInput(cardId)
  }, [cardId])

  const handleEditorFocus = useCallback(() => {
    const content = useCardStore.getState().cards[cardId]?.content
    if (content) useEditorHistoryStore.getState().recordSnapshot(cardId, content)
    useViewStore.getState().setEditingCardId(cardId)
    // 编辑聚焦 = 单选语义：取消其他节点的选中。
    // 否则多选后点击某张卡进入编辑（或点击编辑器内部移动光标）时，
    // 其他节点仍保持 selected → 多选误判 → 本卡选中态被隐藏（显示编辑态
    // 黑边框）+ 外部出现整体缩放框（蓝框）。
    setNodes(nds => nds.map(n => {
      const cid = (n.data as Record<string, unknown>)?.cardId
      if (cid === cardId) return n
      return n.selected ? { ...n, selected: false } : n
    }))
  }, [cardId, setNodes])

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
    try {
      if (coords) editor.focusAtCoords(coords)
      else editor.focus()
    } catch {
      // 坐标定位/聚焦失败不阻塞编辑：兜底聚焦到编辑器默认位置，
      // 避免编辑器从未获得焦点 → 失焦事件不触发 → 编辑态残留（黑色边框）
      try { editor.focus() } catch { /* ignore */ }
    }
  }, [cardId])

  return {
    isEditing,
    editorRef,
    beginEditingAt,
    prepareEditorForReveal,
    handleContentChange,
    handleUserInput,
    handleEditorFocus,
    handleEditorBlur,
  }
}
