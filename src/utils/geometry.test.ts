import { describe, it, expect } from 'vitest'
import { Bound, edgePointOnRect, getBestHandles, positionToHandleId } from './geometry'
import { Position } from '@xyflow/react'

describe('Bound', () => {
  it('构造和基本属性', () => {
    const b = new Bound(10, 20, 100, 50)
    expect(b.x).toBe(10)
    expect(b.y).toBe(20)
    expect(b.w).toBe(100)
    expect(b.h).toBe(50)
  })

  it('center 应返回中心点', () => {
    const b = new Bound(0, 0, 100, 200)
    expect(b.center).toEqual({ x: 50, y: 100 })
  })

  it('contains — 包含', () => {
    const outer = new Bound(0, 0, 200, 200)
    const inner = new Bound(50, 50, 50, 50)
    expect(outer.contains(inner)).toBe(true)
  })

  it('contains — 不包含', () => {
    const a = new Bound(0, 0, 100, 100)
    const b = new Bound(50, 50, 100, 100)
    expect(a.contains(b)).toBe(false)
  })

  it('intersects — 有重叠', () => {
    const a = new Bound(0, 0, 100, 100)
    const b = new Bound(50, 50, 100, 100)
    expect(a.intersects(b)).toBe(true)
  })

  it('intersects — 无重叠', () => {
    const a = new Bound(0, 0, 100, 100)
    const b = new Bound(200, 200, 100, 100)
    expect(a.intersects(b)).toBe(false)
  })

  it('serialize / deserialize', () => {
    const b = new Bound(10, 20, 100, 50)
    expect(Bound.deserialize(b.serialize())).toEqual(b)
  })

  it('fromDOMRect', () => {
    const rect = { left: 5, top: 10, width: 80, height: 40, right: 85, bottom: 50, x: 5, y: 10 }
    const b = Bound.fromDOMRect(rect as DOMRect)
    expect(b).toEqual(new Bound(5, 10, 80, 40))
  })
})

describe('edgePointOnRect', () => {
  it('目标在右侧应返回右边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, 200, 50)
    expect(result).toEqual({ x: 100, y: 50 })
  })

  it('目标在左侧应返回左边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, -50, 50)
    expect(result).toEqual({ x: 0, y: 50 })
  })

  it('目标在下方应返回下边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, 50, 200)
    expect(result).toEqual({ x: 50, y: 100 })
  })

  it('目标在上方应返回上边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, 50, -50)
    expect(result).toEqual({ x: 50, y: 0 })
  })
})

describe('getBestHandles', () => {
  it('目标在右侧应选 right → left-target', () => {
    const result = getBestHandles(
      { x: 0, y: 0 }, { w: 100, h: 100 },
      { x: 400, y: 100 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('right')
    expect(result.targetHandle).toBe('left-target')
  })

  it('目标在左侧应选 left → right-target', () => {
    const result = getBestHandles(
      { x: 400, y: 100 }, { w: 100, h: 100 },
      { x: 0, y: 0 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('left')
    expect(result.targetHandle).toBe('right-target')
  })

  it('目标在正下方应选 bottom → top-target', () => {
    const result = getBestHandles(
      { x: 50, y: 0 }, { w: 100, h: 100 },
      { x: 50, y: 300 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('bottom')
    expect(result.targetHandle).toBe('top-target')
  })

  it('目标在正上方应选 top → bottom-target', () => {
    const result = getBestHandles(
      { x: 50, y: 300 }, { w: 100, h: 100 },
      { x: 50, y: 0 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('top')
    expect(result.targetHandle).toBe('bottom-target')
  })
})

describe('positionToHandleId', () => {
  it('Position.Top → top', () => {
    expect(positionToHandleId(Position.Top)).toBe('top')
  })
  it('Position.Bottom → bottom', () => {
    expect(positionToHandleId(Position.Bottom)).toBe('bottom')
  })
  it('Position.Left → left', () => {
    expect(positionToHandleId(Position.Left)).toBe('left')
  })
  it('Position.Right → right', () => {
    expect(positionToHandleId(Position.Right)).toBe('right')
  })
})
