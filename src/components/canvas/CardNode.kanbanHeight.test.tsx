// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ResizeCallback = (entries: Array<{ contentRect: { height: number } }>) => void
type TestNode = Record<string, unknown>

// 画布实例与 ResizeObserver 都是外部环境：这里用可观测的替身驱动看板 MiniCard 的高度回调。
const h = vi.hoisted(() => {
  const state = { nodes: [] as TestNode[], updates: 0 }
  const setNodes = vi.fn((payload: unknown) => {
    const previous = state.nodes
    const next = typeof payload === 'function'
      ? (payload as (nds: TestNode[]) => TestNode[])(previous)
      : payload as TestNode[]
    if (next !== previous) state.updates += 1
    state.nodes = next
  })
  const observers: Array<{ callback: ResizeCallback }> = []
  const frames: FrameRequestCallback[] = []
  return { state, setNodes, observers, frames }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: h.setNodes,
    setEdges: vi.fn(),
    getNode: (id: string) => h.state.nodes.find(node => node.id === id),
    getEdges: () => [],
  }),
  // 卡片外壳用到的手柄/缩放手柄在 jsdom 里没有画布上下文，渲染成空占位即可。
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
}))

class ResizeObserverStub {
  constructor(callback: ResizeCallback) {
    h.observers.push({ callback })
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { CardNode } from './CardNode'
import { useCardStore } from '../../stores/cardStore'

const CardNodeUnderTest = CardNode as unknown as ComponentType<Record<string, unknown>>

const FRAME_ID = 'frame-1'
const CARD_ID = 'card-1'

function frameNode(layout: string): TestNode {
  return {
    id: FRAME_ID,
    type: 'frame',
    position: { x: 0, y: 0 },
    data: { name: 'Frame', layout, width: 600, height: 400 },
  }
}

function cardNode(height: number, frameId: string | undefined = FRAME_ID): TestNode {
  return {
    id: CARD_ID,
    type: 'card',
    position: { x: 10, y: 10 },
    data: {
      cardId: CARD_ID,
      ...(frameId ? { frameId, frameLayout: 'kanban' } : {}),
      color: 'white',
      width: 260,
      height,
    },
  }
}

function renderMiniCard(height = 100, layout = 'kanban') {
  h.state.nodes = [frameNode(layout), cardNode(height)]
  return render(
    <CardNodeUnderTest
      id={CARD_ID}
      type="card"
      data={(h.state.nodes[1] as { data: Record<string, unknown> }).data}
      selected={false}
      dragging={false}
      zIndex={10}
      isConnectable
      positionAbsoluteX={10}
      positionAbsoluteY={10}
    />,
  )
}

function fireResize(height: number) {
  act(() => {
    for (const observer of h.observers) observer.callback([{ contentRect: { height } }])
    // 高度更新按动画帧合并：手动 flush 一帧，模拟浏览器下一帧提交。
    for (const frame of h.frames.splice(0)) frame(0)
  })
}

function cardHeight(): unknown {
  const card = h.state.nodes.find(node => node.id === CARD_ID) as { data: Record<string, unknown> }
  return card.data.height
}

beforeEach(() => {
  h.observers.length = 0
  h.frames.length = 0
  h.state.updates = 0
  h.setNodes.mockClear()
  useCardStore.setState({
    cards: {
      [CARD_ID]: {
        id: CARD_ID,
        title: '卡片',
        color: 'white',
        content: '[{"type":"paragraph","content":[]}]',
        createdAt: 1,
      },
    },
    isLoaded: true,
  })
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    h.frames.push(callback)
    return h.frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useCardStore.setState({ cards: {}, isLoaded: false })
})

describe('CardNode 看板 MiniCard 高度回调', () => {
  it('内容高度变化超过阈值时写回卡片高度并按看板重新排布', () => {
    renderMiniCard(100)
    expect(h.observers).toHaveLength(1)
    const updatesAfterMount = h.state.updates

    fireResize(150)

    expect(cardHeight()).toBe(150)
    // 看板布局会同时下沉 localX/localY，供 Frame 重排与快照使用。
    const card = h.state.nodes.find(node => node.id === CARD_ID) as { data: Record<string, unknown> }
    expect(typeof card.data.localX).toBe('number')
    expect(typeof card.data.localY).toBe('number')
    expect(h.state.updates).toBe(updatesAfterMount + 1)
  })

  it('高度抖动不超过阈值时不触发 store 更新', () => {
    renderMiniCard(100)
    const updatesAfterMount = h.state.updates

    fireResize(102)
    fireResize(98)

    expect(h.state.updates).toBe(updatesAfterMount)
  })

  it('同一帧内的多次高度变化合并成一次 store 更新', () => {
    renderMiniCard(100)
    const updatesAfterMount = h.state.updates

    act(() => {
      for (const observer of h.observers) {
        for (const height of [150, 160, 170, 180, 190]) {
          observer.callback([{ contentRect: { height } }])
        }
      }
      for (const frame of h.frames.splice(0)) frame(0)
    })

    // 基线：不合并时 5 次回调 = 5 次 store 更新；合并后只写最后一帧的最新高度。
    expect(h.state.updates).toBe(updatesAfterMount + 1)
    expect(cardHeight()).toBe(190)
  })

  it('Frame 不是看板布局时忽略高度回调', () => {
    renderMiniCard(100, 'free')
    const updatesAfterMount = h.state.updates

    fireResize(200)

    expect(cardHeight()).toBe(100)
    expect(h.state.updates).toBe(updatesAfterMount)
  })

  it('卡片不在 Frame 内时不会因为尺寸观察写回高度', () => {
    h.state.nodes = [cardNode(100, undefined)]
    render(
      <CardNodeUnderTest
        id={CARD_ID}
        type="card"
        data={(h.state.nodes[0] as { data: Record<string, unknown> }).data}
        selected={false}
        dragging={false}
        zIndex={10}
        isConnectable
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />,
    )
    const updatesAfterMount = h.state.updates

    fireResize(200)

    expect(cardHeight()).toBe(100)
    expect(h.state.updates).toBe(updatesAfterMount)
  })
})
