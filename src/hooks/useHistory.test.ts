import { describe, it, expect } from 'vitest'
import { useHistory } from '../hooks/useHistory'

function makeEntry(nodeCount: number) {
  return {
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n-${i}-${Date.now()}-${Math.random()}`,
      type: 'card' as const,
      position: { x: 0, y: 0 },
      data: { cardId: `card-${i}` },
    })),
    edges: [] as Array<{
      id: string
      source: string
      target: string
      type?: string
      sourceHandle?: string | null
      targetHandle?: string | null
    }>,
  }
}

describe('useHistory memory limits', () => {
  it('should enforce maxHistory count', () => {
    const history = useHistory({ maxHistory: 5 })

    for (let i = 0; i < 8; i++) {
      history.record(makeEntry(1))
    }

    expect(history.canUndo).toBe(true)
    let undoCount = 0
    while (history.canUndo) {
      history.undo()
      undoCount++
    }
    expect(undoCount).toBeLessThanOrEqual(5)
  })

  it('should enforce memory size limit by trimming old entries', () => {
    const history = useHistory({ maxHistory: 100 })

    for (let i = 0; i < 30; i++) {
      history.record(makeEntry(500))
    }

    expect(history.canUndo).toBe(true)
    let undoCount = 0
    while (history.canUndo) {
      history.undo()
      undoCount++
    }
    // 500 nodes × 500B = 250KB/条，30条 = 7.5MB > 5MB 上限
    expect(undoCount).toBeLessThan(30)
  })

  it('should preserve at least 2 entries even if over size limit', () => {
    const history = useHistory({ maxHistory: 100 })

    for (let i = 0; i < 30; i++) {
      history.record(makeEntry(500))
    }

    let undoCount = 0
    while (history.canUndo) {
      history.undo()
      undoCount++
    }
    expect(undoCount).toBeGreaterThanOrEqual(2)
  })
})
