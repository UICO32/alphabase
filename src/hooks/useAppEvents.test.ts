// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { on } from '../stores/eventBus'
import { useAppEvents } from './useAppEvents'

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'

afterEach(() => {
  cleanup()
  localStorage.removeItem(LAST_WORKSPACE_KEY)
  delete (window as any).__activeSyncEngine
  delete (window as any).electronAPI
})

describe('useAppEvents 关闭前保存', () => {
  it('beforeunload 先序列化当前画板，再 flush 引擎', () => {
    const order: string[] = []
    const off = on('save-current-board', () => { order.push('save-current-board') })
    const flushNow = vi.fn(() => { order.push('flushNow') })
    ;(window as any).__activeSyncEngine = { flushNow }

    renderHook(() => useAppEvents({ dataReady: false, setShowWorkspacePicker: vi.fn() }))
    window.dispatchEvent(new Event('beforeunload'))

    expect(flushNow).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['save-current-board', 'flushNow'])
    off()
  })

  it('Electron 关闭信号同样先序列化再等待引擎 flush', async () => {
    const order: string[] = []
    const off = on('save-current-board', () => { order.push('save-current-board') })
    const flushAll = vi.fn(async () => { order.push('flushAll') })
    ;(window as any).__activeSyncEngine = { flushAll }
    let closeCallback: (() => Promise<void>) | null = null
    ;(window as any).electronAPI = {
      onFlushBeforeClose: (callback: () => Promise<void>) => {
        closeCallback = callback
        return () => {}
      },
    }

    renderHook(() => useAppEvents({ dataReady: false, setShowWorkspacePicker: vi.fn() }))
    expect(closeCallback).not.toBeNull()
    await closeCallback!()

    expect(flushAll).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['save-current-board', 'flushAll'])
    off()
  })
})
