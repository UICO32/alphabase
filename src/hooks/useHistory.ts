import { useCallback, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { GlobalCard } from '../stores/cardStore'

const MAX_HISTORY_BYTES = 5 * 1024 * 1024 // 5MB

function estimateSize(nodes: Node[], edges: Edge[]): number {
  return nodes.length * 500 + edges.length * 100
}

export interface HistoryEntry {
  nodes: Node[]
  edges: Edge[]
  deletedCardsContent?: Record<string, GlobalCard>
  /** @internal 内存估算，不序列化 */
  _size?: number
}

interface UseHistoryOptions {
  maxHistory?: number
}

interface UseHistoryReturn {
  canUndo: boolean
  canRedo: boolean
  record: (entry: Omit<HistoryEntry, never>) => void
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

  const record = useCallback((entry: Omit<HistoryEntry, never>) => {
    const sizedEntry = { ...entry, _size: estimateSize(entry.nodes, entry.edges) } as HistoryEntry
    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    }
    historyRef.current.push(sizedEntry)
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift()
      indexRef.current--
    }
    // 内存上限检查：超限时从头部移除旧条目，至少保留 2 条
    const totalBytes = historyRef.current.reduce((sum, e) => sum + (e._size || 0), 0)
    if (totalBytes > MAX_HISTORY_BYTES && historyRef.current.length > 2) {
      while (historyRef.current.length > 2) {
        const removed = historyRef.current.shift()
        indexRef.current--
        if (!removed) break
        const newTotal = historyRef.current.reduce((sum, e) => sum + (e._size || 0), 0)
        if (newTotal <= MAX_HISTORY_BYTES) break
      }
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

  return { canUndo, canRedo, record, undo, redo, clear }
}
