import { describe, expect, it, vi } from 'vitest'
import { createAnnotationHeightBatcher } from './annotationHeightBatcher'

describe('createAnnotationHeightBatcher', () => {
  it('commits only the latest observed height once per animation frame', () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const onCommit = vi.fn()
    const batcher = createAnnotationHeightBatcher({
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
    const batcher = createAnnotationHeightBatcher({
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
})
