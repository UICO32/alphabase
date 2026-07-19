import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionSnapCandidate } from './connectionSnap'
import { connectionMediator, type ConnectionRequest } from './connectionMediator'

const previewCandidate: ConnectionSnapCandidate = {
  targetNodeId: 'target',
  sourceHandleId: 'right',
  targetHandleId: 'left-target',
  sourcePoint: { x: 100, y: 50 },
  targetPoint: { x: 200, y: 50 },
  sourcePosition: 'right' as ConnectionSnapCandidate['sourcePosition'],
  targetPosition: 'left' as ConnectionSnapCandidate['targetPosition'],
}

afterEach(() => {
  connectionMediator.clear()
})

describe('connectionMediator.complete', () => {
  it('commits the exact handles cached by the preview candidate', () => {
    const onComplete = vi.fn<[ConnectionRequest]>()
    connectionMediator.onComplete(onComplete)
    connectionMediator.start('source', 'top')
    connectionMediator.setPreviewCandidate(previewCandidate)

    expect(connectionMediator.complete('target', 'bottom-target')).toBe(true)
    expect(onComplete).toHaveBeenCalledWith({
      sourceNodeId: 'source',
      sourceHandleId: 'right',
      targetNodeId: 'target',
      targetHandleId: 'left-target',
    })
    expect(connectionMediator.getPreviewCandidate()).toBeNull()
  })

  it('does not reuse a preview candidate belonging to a different target', () => {
    const onComplete = vi.fn<[ConnectionRequest]>()
    connectionMediator.onComplete(onComplete)
    connectionMediator.start('source', 'top')
    connectionMediator.setPreviewCandidate({ ...previewCandidate, targetNodeId: 'other-target' })

    expect(connectionMediator.complete('target', 'bottom-target')).toBe(true)
    expect(onComplete).toHaveBeenCalledWith({
      sourceNodeId: 'source',
      sourceHandleId: 'top',
      targetNodeId: 'target',
      targetHandleId: 'bottom-target',
    })
  })
})
