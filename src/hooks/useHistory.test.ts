import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from './useHistory'

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

function countUndos(result: { current: ReturnType<typeof useHistory> }, max = 100) {
  let count = 0
  for (let i = 0; i < max; i++) {
    let returned: unknown
    act(() => { returned = result.current.undo() })
    if (returned === null) break
    count++
  }
  return count
}

describe('useHistory memory limits', () => {
  it('should enforce maxHistory count', () => {
    const { result } = renderHook(() => useHistory({ maxHistory: 5 }))

    act(() => {
      for (let i = 0; i < 8; i++) {
        result.current.record(makeEntry(1))
      }
    })

    expect(countUndos(result)).toBeLessThanOrEqual(5)
  })

  it('should enforce memory size limit by trimming old entries', () => {
    const { result } = renderHook(() => useHistory({ maxHistory: 100 }))

    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.record(makeEntry(500))
      }
    })

    expect(countUndos(result)).toBeLessThan(30)
  })

  it('should preserve at least 2 entries even if over size limit', () => {
    const { result } = renderHook(() => useHistory({ maxHistory: 100 }))

    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.record(makeEntry(500))
      }
    })

    expect(countUndos(result)).toBeGreaterThanOrEqual(2)
  })
})
