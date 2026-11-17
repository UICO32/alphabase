// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import type { Viewport } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@xyflow/react', () => ({
  useStoreApi: () => ({ getState: () => ({ transform: [0, 0, 1] }) }),
  // 设计约束：网格层不得订阅 transform，否则平移/缩放每帧都会带着整棵 SVG 树重渲染。
  useStore: () => {
    throw new Error('AdaptiveBackground 不应订阅 React Flow transform')
  },
}))

import { AdaptiveBackground } from './AdaptiveBackground'

const BASE_GAP = 25
const FIRST_STEP = 27

afterEach(cleanup)

describe('AdaptiveBackground', () => {
  it('首帧用初始缩放渲染四层网格与填充矩形', () => {
    const { container } = render(<AdaptiveBackground color="#ffffff" pattern="dot" />)

    const patterns = container.querySelectorAll('pattern')
    expect(patterns).toHaveLength(4)
    expect(patterns[0].getAttribute('width')).toBe(String(BASE_GAP * FIRST_STEP * 1))
    expect(container.querySelectorAll('rect[fill^="url(#"]')).toHaveLength(4)
  })

  it('视口变化通过 frameScheduler 命令式更新，不重渲染 SVG 树', () => {
    const visualViewportRef: { current: Viewport | null } = { current: null }
    const frameSchedulerRef: { current: (() => void) | null } = { current: null }
    const { container } = render(
      <AdaptiveBackground
        color="#ffffff"
        visualViewportRef={visualViewportRef}
        frameSchedulerRef={frameSchedulerRef}
      />,
    )

    const firstPattern = container.querySelectorAll('pattern')[0]
    expect(frameSchedulerRef.current).toBeTypeOf('function')

    visualViewportRef.current = { x: 10, y: 20, zoom: 2 }
    act(() => frameSchedulerRef.current?.())

    const scaledGap = BASE_GAP * FIRST_STEP * 2
    expect(firstPattern.getAttribute('width')).toBe(String(scaledGap))
    expect(firstPattern.getAttribute('x')).toBe(String(10 % scaledGap))
    expect(firstPattern.getAttribute('y')).toBe(String(20 % scaledGap))
    // DOM 节点没被替换：说明没有走 React 重渲染，而是原地改属性。
    expect(container.querySelectorAll('pattern')[0]).toBe(firstPattern)
  })
})
