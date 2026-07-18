import { describe, expect, it, vi } from 'vitest'
import { scheduleEditorReadyAfterLayout } from './BlockNoteEditor'

describe('scheduleEditorReadyAfterLayout', () => {
  it('notifies once on the next animation frame', () => {
    let callback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((next: FrameRequestCallback) => {
      callback = next
      return 7
    })
    const cancelFrame = vi.fn()
    const onReady = vi.fn()

    scheduleEditorReadyAfterLayout(requestFrame, cancelFrame, onReady)
    expect(onReady).not.toHaveBeenCalled()
    callback?.(16)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('cancels the pending notification on unmount', () => {
    const requestFrame = vi.fn(() => 9)
    const cancelFrame = vi.fn()
    const cleanup = scheduleEditorReadyAfterLayout(requestFrame, cancelFrame, vi.fn())

    cleanup()
    expect(cancelFrame).toHaveBeenCalledWith(9)
  })
})
