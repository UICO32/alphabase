import { describe, it, expect } from 'vitest'
import { calcSnapNudge, getNodesBounds } from '../../src/components/canvas/utils/alignment'
import type { SnapBounds } from '../../src/components/canvas/utils/alignment'

describe('calcSnapNudge', () => {
  const threshold = 10

  it('无其他节点时返回零偏移', () => {
    const dragBounds = { x: 100, y: 200, width: 280, height: 200 }
    const result = calcSnapNudge(dragBounds, [], threshold)
    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('左边缘接近时吸附', () => {
    const dragBounds = { x: 105, y: 50, width: 280, height: 200 }
    const otherBounds = [{ x: 100, y: 0, width: 280, height: 200 }]
    const result = calcSnapNudge(dragBounds, otherBounds, threshold)
    expect(result.x).toBe(-5)
    expect(result.y).toBe(0)
  })

  it('右边缘接近时吸附', () => {
    const dragBounds = { x: 105, y: 50, width: 280, height: 200 }
    const otherBounds = [{ x: 100, y: 0, width: 280, height: 200 }]
    const result = calcSnapNudge(dragBounds, otherBounds, threshold)
    expect(result.x).toBe(-5)
  })

  it('上边缘接近时吸附', () => {
    const dragBounds = { x: 500, y: 102, width: 280, height: 200 }
    const otherBounds = [{ x: 0, y: 100, width: 280, height: 200 }]
    const result = calcSnapNudge(dragBounds, otherBounds, threshold)
    expect(result.x).toBe(0)
    expect(result.y).toBe(-2)
  })

  it('下边缘接近时吸附', () => {
    const dragBounds = { x: 500, y: 305, width: 280, height: 200 }
    const otherBounds = [{ x: 0, y: 100, width: 280, height: 200 }]
    const result = calcSnapNudge(dragBounds, otherBounds, threshold)
    expect(result.y).toBe(-5)
  })

  it('距离超过阈值时不吸附', () => {
    const dragBounds = { x: 120, y: 50, width: 280, height: 200 }
    const otherBounds = [{ x: 100, y: 0, width: 280, height: 200 }]
    const result = calcSnapNudge(dragBounds, otherBounds, threshold)
    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('多个节点中取最近吸附', () => {
    const dragBounds = { x: 103, y: 50, width: 280, height: 200 }
    const otherBounds = [
      { x: 100, y: 0, width: 280, height: 200 },
      { x: 95, y: 0, width: 280, height: 200 },
    ]
    const result = calcSnapNudge(dragBounds, otherBounds, threshold)
    expect(result.x).toBe(-3)
  })

  it('X和Y同时吸附', () => {
    const dragBounds = { x: 105, y: 107, width: 280, height: 200 }
    const otherBounds = [{ x: 100, y: 100, width: 280, height: 200 }]
    const result = calcSnapNudge(dragBounds, otherBounds, threshold)
    expect(result.x).toBe(-5)
    expect(result.y).toBe(-7)
  })
})

describe('getNodesBounds', () => {
  it('从 Node 数组提取 bounds', () => {
    const nodes = [
      { id: 'a', position: { x: 100, y: 200 }, data: { width: 280, height: 200 }, type: 'card' },
    ] as any
    const result = getNodesBounds(nodes)
    expect(result).toEqual([{ x: 100, y: 200, width: 280, height: 200 }])
  })

  it('collapsed 卡片使用 COLLAPSED_CARD_HEIGHT', () => {
    const nodes = [
      { id: 'a', position: { x: 100, y: 200 }, data: { width: 280, height: 200, collapsed: true }, type: 'card' },
    ] as any
    const result = getNodesBounds(nodes)
    expect(result[0].height).toBe(80)
  })
})
