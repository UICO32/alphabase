import { describe, expect, it, vi } from 'vitest'
import { createHeightBatcher } from './heightBatcher'

describe('createHeightBatcher', () => {
  it('commits only the latest observed height once per animation frame', () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const onCommit = vi.fn()
    const batcher = createHeightBatcher({
      initialHeight: 100,
      threshold: 4,
      onCommit,
      requestFrame: vi.fn((callback) => {
        frameCallbacks.push(callback)
        return 17
      }),
    })

    batcher.schedule(112)
    batcher.schedule(128)
    batcher.schedule(136)

    expect(frameCallbacks).toHaveLength(1)
    expect(onCommit).not.toHaveBeenCalled()
    frameCallbacks[0](0)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(136)
  })

  it('ignores threshold noise and cancels pending work on dispose', () => {
    const cancelFrame = vi.fn()
    const requestFrame = vi.fn(() => 23)
    const onCommit = vi.fn()
    const batcher = createHeightBatcher({
      initialHeight: 100,
      threshold: 4,
      onCommit,
      requestFrame,
      cancelFrame,
    })

    batcher.schedule(103)
    expect(requestFrame).not.toHaveBeenCalled()

    batcher.schedule(120)
    batcher.dispose()

    expect(cancelFrame).toHaveBeenCalledWith(23)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('treats the threshold itself as noise and the next pixel as a change', () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const onCommit = vi.fn()
    const batcher = createHeightBatcher({
      initialHeight: 100,
      threshold: 4,
      onCommit,
      requestFrame: callback => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      },
    })

    batcher.schedule(104)
    expect(frameCallbacks).toHaveLength(0)

    batcher.schedule(105)
    expect(frameCallbacks).toHaveLength(1)
    frameCallbacks[0](0)
    expect(onCommit).toHaveBeenCalledWith(105)
  })

  it('measures noise against the last committed height, not the last observed one', () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const onCommit = vi.fn()
    const batcher = createHeightBatcher({
      initialHeight: 100,
      threshold: 4,
      onCommit,
      requestFrame: callback => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      },
    })

    batcher.schedule(120)
    frameCallbacks[0](0)
    expect(onCommit).toHaveBeenCalledWith(120)

    // 相对已提交的 120 只差 2：属于抖动，不再排帧。
    batcher.schedule(122)
    expect(frameCallbacks).toHaveLength(1)

    batcher.schedule(130)
    expect(frameCallbacks).toHaveLength(2)
    frameCallbacks[1](0)
    expect(onCommit).toHaveBeenLastCalledWith(130)
  })
})
