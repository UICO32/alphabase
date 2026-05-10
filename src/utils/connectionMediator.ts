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

export const connectionMediator = {
  start(sourceNodeId: string, sourceHandleId: string) {
    pending = { sourceNodeId, sourceHandleId }
    listeners.forEach((fn) => fn())
  },

  getPending(): PendingConnection | null {
    return pending
  },

  clear() {
    pending = null
    listeners.forEach((fn) => fn())
  },

  isConnecting(): boolean {
    return pending !== null
  },

  isConnectingFrom(nodeId: string): boolean {
    return pending?.sourceNodeId === nodeId
  },

  complete(targetNodeId: string, targetHandleId: string) {
    if (!pending || !completeHandler) return false
    completeHandler({
      sourceNodeId: pending.sourceNodeId,
      sourceHandleId: pending.sourceHandleId,
      targetNodeId,
      targetHandleId,
    })
    pending = null
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
}
