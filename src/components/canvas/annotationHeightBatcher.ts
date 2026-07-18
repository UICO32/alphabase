interface AnnotationHeightBatcherOptions {
  initialHeight: number
  threshold: number
  onCommit: (height: number) => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (frameId: number) => void
}

export function createAnnotationHeightBatcher({
  initialHeight,
  threshold,
  onCommit,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
}: AnnotationHeightBatcherOptions) {
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
