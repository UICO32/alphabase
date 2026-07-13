import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useCardStore, type GlobalCard } from '../../stores/cardStore'
import { useViewStore } from '../../stores/viewStore'
import { registerEditorHandle, clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import type { BlockNoteEditorHandle } from '../editor/BlockNoteEditor'

type UpdateCard = (id: string, props: Partial<GlobalCard>) => void

interface UseCardNodeEditingArgs {
  cardId: string
  selected: boolean
  updateCard: UpdateCard
}

export function useCardNodeEditing({
  cardId,
  selected,
  updateCard,
}: UseCardNodeEditingArgs) {
  const [isEditing, setIsEditing] = useState(false)
  const editorRef = useRef<BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)

  const isAutoEdit = useViewStore((s) => s.autoEditCardId === cardId)

  useEffect(() => {
    if (isAutoEdit) setIsEditing(true)
  }, [isAutoEdit])

  useEffect(() => {
    registerEditorHandle(cardId, editorRef.current ?? null)
    return () => registerEditorHandle(cardId, null)
  }, [cardId, isEditing, selected])

  const beginEditingAt = useCallback((coords?: { x: number; y: number }) => {
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

  useEffect(() => {
    if (!isEditing) return

    const coords = clickCoordsRef.current
    let cancelled = false
    let rafId = 0

    const tryFocus = () => {
      if (cancelled) return
      if (!editorRef.current) {
        rafId = requestAnimationFrame(tryFocus)
        return
      }
      clickCoordsRef.current = null
      if (coords) {
        editorRef.current.focusAtCoords(coords)
      } else {
        editorRef.current.focus()
      }
    }

    tryFocus()

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isEditing])

  return {
    isEditing,
    editorRef,
    beginEditingAt,
    handleContentChange,
    handleEditorFocus,
    handleEditorBlur,
  }
}
