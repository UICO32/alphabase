import { useCallback, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { HistoryEntry } from './useHistory'
import { useCardStore } from '../stores/cardStore'
import { useLibraryStore } from '../stores/libraryStore'
import { getEditorHandleForCard, suppressProseMirrorUndo, isProseMirrorSuppressed } from '../utils/editorHandleRegistry'
import { useEvent } from './useEvent'
import type { CardColor } from '../types/card'

const CLIPBOARD_MIME = 'application/x-hepta-cards'

interface CopiedCard {
  color: string
  collapsed: boolean
  width?: number
  height?: number
  content: string
  title?: string
  sourceUrl?: string
}

interface UseCanvasKeyboardOptions {
  undo: () => HistoryEntry | null
  redo: () => HistoryEntry | null
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void
  clear: () => void
  getNodes: () => Node[]
}

function applyEntry(entry: HistoryEntry, setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void, setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void) {
  setNodes(entry.nodes.map(n => ({ ...n, selected: false })))
  setEdges(entry.edges.map(e => ({ ...e })))
  if (entry.deletedCardsContent) {
    const cardStore = useCardStore.getState()
    const nodeIds = new Set(entry.nodes.map(n => n.id))
    for (const [id, card] of Object.entries(entry.deletedCardsContent)) {
      if (nodeIds.has(id)) {
        if (!cardStore.cards[id]) {
          cardStore.addCard(card)
        }
      } else {
        if (cardStore.cards[id]) {
          cardStore.deleteCard(id)
        }
      }
    }
  }
}

export function useCanvasKeyboard({ undo, redo, setNodes, setEdges, clear, getNodes }: UseCanvasKeyboardOptions) {
  const handleUndo = useCallback(() => {
    const entry = undo()
    if (entry) applyEntry(entry, setNodes, setEdges)
  }, [undo, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    const entry = redo()
    if (entry) applyEntry(entry, setNodes, setEdges)
  }, [redo, setNodes, setEdges])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return

      const isUndo = e.key === 'z' && !e.shiftKey
      const isRedo = (e.key === 'z' && e.shiftKey) || e.key === 'y'
      if (!isUndo && !isRedo) return

      const activeEl = document.activeElement
      const inEditor = activeEl && activeEl.closest('.card-blocknote-editor')
      if (inEditor) {
        const editingCardId = useLibraryStore.getState().editingCardId
        const editorHandle = editingCardId ? getEditorHandleForCard(editingCardId) : null
        const pmSuppressed = editingCardId ? isProseMirrorSuppressed(editingCardId) : false

        if (isUndo) {
          if (!pmSuppressed && editorHandle && editorHandle.canUndo()) {
            e.stopImmediatePropagation()
            return
          }
          e.preventDefault()
          e.stopImmediatePropagation()
          if (editingCardId) {
            const cardStore = useCardStore.getState()
            const content = cardStore.undoCardContent(editingCardId)
            if (content) {
              cardStore.updateCard(editingCardId, { content })
              if (editorHandle) editorHandle.setContent(content)
              suppressProseMirrorUndo(editingCardId)
            }
          }
          return
        }

        if (isRedo) {
          if (!pmSuppressed && editorHandle && editorHandle.canRedo()) {
            e.stopImmediatePropagation()
            return
          }
          e.preventDefault()
          e.stopImmediatePropagation()
          if (editingCardId) {
            const cardStore = useCardStore.getState()
            const content = cardStore.redoCardContent(editingCardId)
            if (content) {
              cardStore.updateCard(editingCardId, { content })
              if (editorHandle) editorHandle.setContent(content)
              suppressProseMirrorUndo(editingCardId)
            }
          }
          return
        }
      }

      // 非编辑态 → 画布撤销/重做
      if (isUndo) {
        e.preventDefault()
        handleUndo()
      } else {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // Ctrl+C/V: 复制粘贴卡片
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return

      const activeEl = document.activeElement
      const inEditor = activeEl && activeEl.closest('.card-blocknote-editor, .ProseMirror, .bn-editor, input, textarea, [contenteditable]')

      if (e.key === 'c' && !inEditor) {
        const selectedNodes = getNodes().filter(n => n.selected && n.type === 'card')
        if (selectedNodes.length === 0) return

        const cardStore = useCardStore.getState()
        const copied: CopiedCard[] = []
        for (const node of selectedNodes) {
          const data = node.data as Record<string, unknown>
          const cardId = data.cardId as string
          const card = cardStore.cards[cardId]
          if (!card) continue
          copied.push({
            color: (data.color as string) || card.color || 'white',
            collapsed: (data.collapsed as boolean) ?? card.collapsed ?? false,
            width: data.width as number | undefined,
            height: data.height as number | undefined,
            content: card.content,
            title: card.title,
            sourceUrl: card.sourceUrl,
          })
        }
        if (copied.length === 0) return

        e.preventDefault()
        const json = JSON.stringify(copied)
        navigator.clipboard.write([
          new ClipboardItem({
            [CLIPBOARD_MIME]: new Blob([json], { type: CLIPBOARD_MIME }),
            'text/plain': new Blob([json], { type: 'text/plain' }),
          }),
        ]).catch(() => {})
      }

      if (e.key === 'v' && !inEditor) {
        navigator.clipboard.read().then(async (items) => {
          for (const item of items) {
            if (!item.types.includes(CLIPBOARD_MIME)) continue

            e.preventDefault()
            const blob = await item.getType(CLIPBOARD_MIME)
            const json = await blob.text()
            const copied: CopiedCard[] = JSON.parse(json)

            const cardStore = useCardStore.getState()
            const newNodes: Node[] = []

            for (let i = 0; i < copied.length; i++) {
              const src = copied[i]
              const newCardId = crypto.randomUUID()
              cardStore.addCard({
                id: newCardId,
                content: src.content,
                color: src.color as CardColor,
                collapsed: src.collapsed,
                title: src.title,
                sourceUrl: src.sourceUrl,
                createdAt: Date.now(),
              })
              newNodes.push({
                id: newCardId,
                type: 'card',
                position: { x: 20 + i * 40, y: 20 + i * 40 },
                data: {
                  cardId: newCardId,
                  color: src.color,
                  collapsed: src.collapsed,
                  width: src.width,
                  height: src.height,
                },
              })
            }
            setNodes((nds) => [...nds, ...newNodes])
            break
          }
        }).catch(() => {})
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [getNodes, setNodes])

  useEvent('reinit-workspace', () => {
    clear()
    useCardStore.getState().clearCardHistory()
  }, [clear])

  return { handleUndo, handleRedo }
}