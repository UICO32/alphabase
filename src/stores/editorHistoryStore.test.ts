import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorHistoryStore } from './editorHistoryStore'

describe('EditorHistoryStore', () => {
  beforeEach(() => {
    useEditorHistoryStore.setState({
      cardHistory: {},
      isUndoingContent: {},
    })
  })

  it('recordSnapshot 应记录内容快照', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    const history = useEditorHistoryStore.getState().cardHistory['card-1']
    expect(history).toBeDefined()
    expect(history.entries).toEqual(['v1'])
    expect(history.index).toBe(0)
  })

  it('undo 应回退到上一个内容快照', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v2')
    const result = useEditorHistoryStore.getState().undoContent('card-1')
    expect(result).toBe('v1')
  })

  it('redo 应前进到下一个内容快照', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v2')
    useEditorHistoryStore.getState().undoContent('card-1')
    const result = useEditorHistoryStore.getState().redoContent('card-1')
    expect(result).toBe('v2')
  })

  it('无历史时 undo 应返回 null', () => {
    expect(useEditorHistoryStore.getState().undoContent('card-1')).toBeNull()
  })

  it('无历史时 redo 应返回 null', () => {
    expect(useEditorHistoryStore.getState().redoContent('card-1')).toBeNull()
  })

  it('在末尾时 redo 应返回 null', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    expect(useEditorHistoryStore.getState().redoContent('card-1')).toBeNull()
  })

  it('连续相同内容不应重复记录', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    const history = useEditorHistoryStore.getState().cardHistory['card-1']
    expect(history.entries).toHaveLength(1)
  })

  it('clearHistory 应清除指定卡片历史', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    useEditorHistoryStore.getState().clearHistory('card-1')
    expect(useEditorHistoryStore.getState().cardHistory['card-1']).toBeUndefined()
  })

  it('clearHistory 无参数应清除全部历史', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    useEditorHistoryStore.getState().recordSnapshot('card-2', 'v1')
    useEditorHistoryStore.getState().clearHistory()
    expect(Object.keys(useEditorHistoryStore.getState().cardHistory)).toHaveLength(0)
  })

  it('undo 后应设置 isUndoingContent 标记', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v2')
    useEditorHistoryStore.getState().undoContent('card-1')
    expect(useEditorHistoryStore.getState().isUndoingContent['card-1']).toBe(true)
  })

  it('consumeUndoFlag 应清除 isUndoingContent 标记', () => {
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v1')
    useEditorHistoryStore.getState().recordSnapshot('card-1', 'v2')
    useEditorHistoryStore.getState().undoContent('card-1')
    useEditorHistoryStore.getState().consumeUndoFlag('card-1')
    expect(useEditorHistoryStore.getState().isUndoingContent['card-1']).toBeUndefined()
  })

  it('历史上限 10 条，超过时移除最早条目', () => {
    for (let i = 0; i < 15; i++) {
      useEditorHistoryStore.getState().recordSnapshot('card-1', `v${i}`)
    }
    const history = useEditorHistoryStore.getState().cardHistory['card-1']
    expect(history.entries.length).toBeLessThanOrEqual(10)
    // 最早的应该被移除，最新的保留
    expect(history.entries[0]).not.toBe('v0')
    expect(history.entries[history.entries.length - 1]).toBe('v14')
  })
})
