import { useCallback, useEffect } from 'react'
import type { HistoryEntry } from './useHistory'
import { useLibraryStore } from '../stores/libraryStore'
import { useCardStore } from '../stores/cardStore'

interface UseCanvasKeyboardOptions {
  undo: () => HistoryEntry | null
  redo: () => HistoryEntry | null
  setNodes: (updater: any) => void
  setEdges: (updater: any) => void
  clear: () => void
}

function restoreEntry(entry: HistoryEntry, setNodes: (updater: any) => void, setEdges: (updater: any) => void) {
  setNodes(entry.nodes.map(n => ({ ...n, selected: false })))
  setEdges(entry.edges.map(e => ({ ...e })))
  if (entry.cardSnapshot) {
    useCardStore.getState().importCards(entry.cardSnapshot)
  }
}

export function useCanvasKeyboard({ undo, redo, setNodes, setEdges, clear }: UseCanvasKeyboardOptions) {
  const handleUndo = useCallback(() => {
    const entry = undo()
    if (entry) restoreEntry(entry, setNodes, setEdges)
  }, [undo, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    const entry = redo()
    if (entry) restoreEntry(entry, setNodes, setEdges)
  }, [redo, setNodes, setEdges])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return

      const editingCardId = useLibraryStore.getState().editingCardId
      const activeEl = document.activeElement
      const inEditor = editingCardId || (activeEl && activeEl.closest('.card-blocknote-editor'))
      if (inEditor) return

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  useEffect(() => {
    const handleWorkspaceChange = () => {
      clear()
    }
    window.addEventListener('hepta-reinit-workspace', handleWorkspaceChange)
    return () => window.removeEventListener('hepta-reinit-workspace', handleWorkspaceChange)
  }, [clear])

  return { handleUndo, handleRedo }
}
