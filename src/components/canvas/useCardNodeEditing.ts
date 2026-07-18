import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useCardStore, type GlobalCard } from '../../stores/cardStore'
import { useViewStore } from '../../stores/viewStore'
import { registerEditorHandle, clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import type { BlockNoteEditorHandle } from '../editor/BlockNoteEditor'

type UpdateCard = (id: string, props: Partial<GlobalCard>) => void

export interface EditorFocusIntent {
  x: number
  y: number
  textOffset?: number
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

  const isAutoEdit = useViewStore((s) => s.autoEditCardId === cardId)

  useEffect(() => {
    if (isAutoEdit) setIsEditing(true)
  }, [isAutoEdit])

  useEffect(() => {
    registerEditorHandle(cardId, editorRef.current ?? null)
    return () => registerEditorHandle(cardId, null)
  }, [cardId, isEditing, selected])

  const beginEditingAt = useCallback((coords?: EditorFocusIntent) => {
    clickCoordsRef.current = coords ?? null
    setIsEditing(true)
  }, [])

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
  }, [cardId])

  const prepareEditorForReveal = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const coords = takeEditorFocusIntent(clickCoordsRef)
    if (coords) editor.focusAtCoords(coords)
    else editor.focus()
  }, [])

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
