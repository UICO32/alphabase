import { getBestHandles } from './geometry'

export interface PendingConnection {
  sourceNodeId: string
  sourceHandleId: string
}

export interface ConnectionRequest {
  sourceNodeId: string
  sourceHandleId: string
  targetNodeId: string
  targetHandleId: string
}

type Listener = () => void
type CompleteHandler = (request: ConnectionRequest) => void

let pending: PendingConnection | null = null
let listeners = new Set<Listener>()
let completeHandler: CompleteHandler | null = null
let _nearbyTargetId: string | null = null

export const connectionMediator = {
  start(sourceNodeId: string, sourceHandleId: string) {
    pending = { sourceNodeId, sourceHandleId }
    _nearbyTargetId = null
    listeners.forEach((fn) => fn())
  },

  getPending(): PendingConnection | null {
    return pending
  },

  clear() {
    pending = null
    _nearbyTargetId = null
    listeners.forEach((fn) => fn())
  },

  isConnecting(): boolean {
    return pending !== null
  },

  isConnectingFrom(nodeId: string): boolean {
    return pending?.sourceNodeId === nodeId
  },

  complete(
    targetNodeId: string,
    targetHandleId: string,
    sourcePos?: { x: number; y: number },
    sourceSize?: { w: number; h: number },
    targetPos?: { x: number; y: number },
    targetSize?: { w: number; h: number },
  ) {
    if (!pending || !completeHandler) return false

    let sourceHandleId = pending.sourceHandleId
    let finalTargetHandleId = targetHandleId

    if (sourcePos && sourceSize && targetPos && targetSize) {
      const handles = getBestHandles(sourcePos, sourceSize, targetPos, targetSize)
      sourceHandleId = handles.sourceHandle
      finalTargetHandleId = handles.targetHandle
    }

    completeHandler({
      sourceNodeId: pending.sourceNodeId,
      sourceHandleId,
      targetNodeId,
      targetHandleId: finalTargetHandleId,
    })
    pending = null
    _nearbyTargetId = null
    listeners.forEach((fn) => fn())
    return true
  },

  onComplete(handler: CompleteHandler) {
    completeHandler = handler
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  setNearbyTarget(nodeId: string | null) {
    if (_nearbyTargetId !== nodeId) {
      _nearbyTargetId = nodeId
      listeners.forEach((fn) => fn())
    }
  },

  getNearbyTarget(): string | null {
    return _nearbyTargetId
  },
}