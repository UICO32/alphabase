import { useCallback, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { GlobalCard } from '../stores/cardStore'

export interface HistoryEntry {
  type: 'canvas' | 'structure' | 'cards'
  description: string
  nodes: Node[]
  edges: Edge[]
  cardSnapshot?: Record<string, GlobalCard>
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
  }, [])

  const record = useCallback((entry: Omit<HistoryEntry, 'timestamp'>) => {
    const fullEntry = entry as HistoryEntry

    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    }

    historyRef.current.push(fullEntry)

    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift()
    }

    indexRef.current = historyRef.current.length - 1

    updateState()
  }, [maxHistory, updateState])

  const undo = useCallback((): HistoryEntry | null => {
    if (indexRef.current <= 0) return null
    indexRef.current--
    const entry = historyRef.current[indexRef.current]
    updateState()
    return entry
  }, [updateState])

  const redo = useCallback((): HistoryEntry | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null
    indexRef.current++
    const entry = historyRef.current[indexRef.current]
    updateState()
    return entry
  }, [updateState])

  const clear = useCallback(() => {
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
