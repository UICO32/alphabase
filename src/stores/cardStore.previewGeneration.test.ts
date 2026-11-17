// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCardStore, type GlobalCard } from './cardStore'

const idleCallbacks: Array<() => void> = []

function buildCards(count: number): Record<string, GlobalCard> {
  const cards: Record<string, GlobalCard> = {}
  for (let index = 0; index < count; index += 1) {
    cards[`card-${index}`] = {
      id: `card-${index}`,
      title: `卡片 ${index}`,
      color: 'white',
      createdAt: index,
      content: `[{"type":"paragraph","content":[{"type":"text","text":"预览内容 ${index}"}]}]`,
    }
  }
  return cards
}

function flushIdleCallbacks() {
  while (idleCallbacks.length > 0) {
    const callback = idleCallbacks.shift()!
    callback()
  }
}

function missingPreviewCount() {
  return Object.values(useCardStore.getState().cards).filter(card => !card.previewHTML).length
}

beforeEach(() => {
  idleCallbacks.length = 0
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idleCallbacks.push(callback)
    return idleCallbacks.length
  })
  useCardStore.setState({ cards: {}, isLoaded: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  useCardStore.setState({ cards: {}, isLoaded: false })
})

describe('schedulePreviewHTMLGeneration 取消逻辑', () => {
  it('新调度会作废旧循环，旧回调不再继续排任务', () => {
    useCardStore.setState({ cards: buildCards(20) })

    useCardStore.getState().schedulePreviewHTMLGeneration()
    expect(idleCallbacks).toHaveLength(1)

    // 第二次调度：作废上一个循环。
    useCardStore.getState().schedulePreviewHTMLGeneration()
    expect(idleCallbacks).toHaveLength(2)

    // 旧循环的回调执行后不得再排下一批。
    const staleCallback = idleCallbacks.shift()!
    staleCallback()
    expect(idleCallbacks).toHaveLength(1)

    // 新循环继续跑完剩余批次。
    flushIdleCallbacks()
    expect(missingPreviewCount()).toBe(0)
  })

  it('没有缺失预览时不排空闲任务', () => {
    useCardStore.setState({ cards: buildCards(3) })
    useCardStore.getState().schedulePreviewHTMLGeneration()
    // 只有 3 张（<=4）时第一批同步生成完，不需要空闲批次。
    expect(missingPreviewCount()).toBe(0)
    expect(idleCallbacks).toHaveLength(0)
  })
})
