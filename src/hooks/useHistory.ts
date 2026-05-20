import { useCallback, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { GlobalCard } from '../stores/cardStore'

export interface HistoryEntry {
  type: 'canvas' | 'structure' | 'cards'
  description: string
  nodes: Node[]
  edges: Edge[]
  cardChanges?: Array<{ id: string; before: GlobalCard; after: GlobalCard }>
}

interface UseHistoryOptions {
  maxHistory?: number
}

interface UseHistoryReturn {
  canUndo: boolean
  canRedo: boolean
  record: (entry: Omit<HistoryEntry, 'timestamp'>) => void
  undo: () => HistoryEntry | null
  redo: () => HistoryEntry | null
  clear: () => void
}

export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const { maxHistory = 20 } = options
  const historyRef = useRef<HistoryEntry[]>([])
  const indexRef = useRef<number>(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const updateState = useCallback(() => {
    const canUndoNow = indexRef.current >= 0
    const canRedoNow = indexRef.current < historyRef.current.length - 1
    setCanUndo(canUndoNow)
    setCanRedo(canRedoNow)
    console.log('[useHistory] state updated:', {
      index: indexRef.current,
      length: historyRef.current.length,
      canUndo: canUndoNow,
      canRedo: canRedoNow,
    })
  }, [])

  const record = useCallback((entry: Omit<HistoryEntry, 'timestamp'>) => {
    const fullEntry = entry as HistoryEntry

    console.log('[useHistory] record called:', {
      type: fullEntry.type,
      description: fullEntry.description,
      nodeCount: fullEntry.nodes.length,
      edgeCount: fullEntry.edges.length,
      currentIndex: indexRef.current,
      historyLength: historyRef.current.length,
    })

    // If we're not at the end of history, truncate the future
    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
      console.log('[useHistory] truncated future, new length:', historyRef.current.length)
    }

    historyRef.current.push(fullEntry)

    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift()
      console.log('[useHistory] shifted old entry, new length:', historyRef.current.length)
    }

    indexRef.current = historyRef.current.length - 1

    updateState()
  }, [maxHistory, updateState])

  const undo = useCallback((): HistoryEntry | null => {
    console.log('[useHistory] undo called, current index:', indexRef.current)
    if (indexRef.current <= 0) {
      console.log('[useHistory] undo: no more history to undo')
      return null
    }
    indexRef.current--
    const entry = historyRef.current[indexRef.current]
    console.log('[useHistory] undo: returned entry at index', indexRef.current, 'nodes:', entry.nodes.length, 'edges:', entry.edges.length)
    updateState()
    return entry
  }, [updateState])

  const redo = useCallback((): HistoryEntry | null => {
    console.log('[useHistory] redo called, current index:', indexRef.current)
    if (indexRef.current >= historyRef.current.length - 1) {
      console.log('[useHistory] redo: no more history to redo')
      return null
    }
    indexRef.current++
    const entry = historyRef.current[indexRef.current]
    console.log('[useHistory] redo: advanced to index', indexRef.current, 'nodes:', entry.nodes.length, 'edges:', entry.edges.length)
    updateState()
    return entry
  }, [updateState])

  const clear = useCallback(() => {
    console.log('[useHistory] clear called')
    historyRef.current = []
    indexRef.current = -1
    updateState()
  }, [updateState])

  return {
    canUndo,
    canRedo,
    record,
    undo,
    redo,
    clear,
  }
}
