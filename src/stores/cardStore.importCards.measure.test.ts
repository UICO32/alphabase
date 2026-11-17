// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

// C-2 测量：批量导入（325 张，与 abasesave1 同规模）期间的 store 更新、排盘与索引调度。
// 只测量、不改实现；如果数字说明不是瓶颈，就不做“批量合并写入”的改造。
const h = vi.hoisted(() => ({ indexCalls: 0 }))

vi.mock('./embeddingStore', () => ({
  embeddingStore: {
    getState: () => ({
      indexCardDebounced: () => { h.indexCalls += 1 },
    }),
  },
}))

import { useCardStore, type GlobalCard } from './cardStore'
import { WorkspaceSyncEngine } from '../sync/syncEngine'
import { subscribeCardStore } from '../sync/subscribeStores'
import { setFSAdapter } from '../utils/workspace/fs'

const CARD_COUNT = 325

function installRecordingAdapter() {
  const writes: string[] = []
  setFSAdapter({
    readFile: async () => new Uint8Array(),
    writeFile: async (path) => { writes.push(path) },
    deleteFile: async (path) => { writes.push(`delete:${path}`) },
    readdir: async () => [],
    readDirFiles: async () => null,
    mkdir: async () => {},
    stat: async () => ({ isDirectory: false, size: 0, mtimeMs: 0 }),
    exists: async () => false,
    rename: async (from, to) => { writes.push(`rename:${from}->${to}`) },
    rmdir: async () => {},
  })
  return writes
}

function buildCards(count: number): Record<string, GlobalCard> {
  const cards: Record<string, GlobalCard> = {}
  for (let index = 0; index < count; index += 1) {
    const id = `card-${index}`
    cards[id] = {
      id,
      title: `卡片 ${index}`,
      color: 'white',
      createdAt: index,
      content: `[{"type":"paragraph","content":[{"type":"text","text":"批量导入内容 ${index}"}]}]`,
    }
  }
  return cards
}

afterEach(() => {
  useCardStore.setState({ cards: {}, isLoaded: false })
})

describe('C-2 批量导入测量', () => {
  it(`导入 ${CARD_COUNT} 张卡片：一次 store 更新、每卡一次排盘、索引逐卡防抖`, async () => {
    const writes = installRecordingAdapter()
    const engine = new WorkspaceSyncEngine()
    await engine.init('D:/measure')
    const unsubscribeEngine = subscribeCardStore(engine)

    useCardStore.setState({ cards: {}, isLoaded: true })
    h.indexCalls = 0

    let storeUpdates = 0
    const unsubscribeStore = useCardStore.subscribe(() => { storeUpdates += 1 })

    const cards = buildCards(CARD_COUNT)
    const startedAt = performance.now()
    useCardStore.getState().importCards(cards)
    const importMs = performance.now() - startedAt

    // 导入本身：单次 set，不产生 N 次 store 通知。
    expect(storeUpdates).toBe(1)
    expect(Object.keys(useCardStore.getState().cards)).toHaveLength(CARD_COUNT)
    // 索引调度逐卡防抖，导入阶段只入队、不阻塞。
    expect(h.indexCalls).toBe(CARD_COUNT)

    await new Promise(resolve => setTimeout(resolve, 800))

    const cardWrites = writes.filter(path => path.startsWith('rename:') && path.includes('/cards/'))
    const metadataWrites = writes.filter(path => path.startsWith('rename:') && path.includes('_metadata.json'))
    // 每张卡片各写一次文件（按 id 独立持久化，这是数据格式决定的），元数据合并成一次。
    expect(cardWrites).toHaveLength(CARD_COUNT)
    expect(metadataWrites).toHaveLength(1)

    console.log(JSON.stringify({
      scenario: 'importCards',
      cardCount: CARD_COUNT,
      storeUpdates,
      indexSchedules: h.indexCalls,
      cardFileWrites: cardWrites.length,
      metadataWrites: metadataWrites.length,
      importMs: Math.round(importMs * 100) / 100,
    }))

    unsubscribeStore()
    unsubscribeEngine()
    engine.discard()
  })
})
