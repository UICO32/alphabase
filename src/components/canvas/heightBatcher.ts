interface HeightBatcherOptions {
  initialHeight: number
  threshold: number
  onCommit: (height: number) => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (frameId: number) => void
}

/** 把同一帧内多次观测到的高度合并成一次提交；threshold 内的抖动不提交。 */
export function createHeightBatcher({
  initialHeight,
  threshold,
  onCommit,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
}: HeightBatcherOptions) {
  let committedHeight = initialHeight
  let pendingHeight = initialHeight
  let frameId: number | null = null

  const commit = () => {
    frameId = null
    if (Math.abs(pendingHeight - committedHeight) <= threshold) return
    committedHeight = pendingHeight
    onCommit(committedHeight)
  }

  return {
    schedule(height: number) {
      pendingHeight = height
      if (frameId === null && Math.abs(pendingHeight - committedHeight) > threshold) {
        frameId = requestFrame(commit)
      }
    },
    dispose() {
      if (frameId !== null) {
        cancelFrame(frameId)
        frameId = null
      }
    },
  }
}
