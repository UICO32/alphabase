import type { ConnectionSnapCandidate } from './connectionSnap'

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
// Global listeners for isConnecting state changes (start/clear/complete)
const globalListeners = new Set<Listener>()
// Per-card listeners for nearby target changes
const cardListeners = new Map<string, Set<Listener>>()
let completeHandler: CompleteHandler | null = null
let _nearbyTargetId: string | null = null
let previewCandidate: ConnectionSnapCandidate | null = null

function notifyCardListeners(cardId: string) {
  const listeners = cardListeners.get(cardId)
  if (listeners) {
    listeners.forEach((fn) => fn())
  }
}

export const connectionMediator = {
  start(sourceNodeId: string, sourceHandleId: string) {
    pending = { sourceNodeId, sourceHandleId }
    _nearbyTargetId = null
    previewCandidate = null
    // Notify global listeners (isConnecting changed)
    globalListeners.forEach((fn) => fn())
    // Notify the source card's listeners (isConnectingFrom changed)
    notifyCardListeners(sourceNodeId)
  },

  getPending(): PendingConnection | null {
    return pending
  },

  clear() {
    const prevSourceId = pending?.sourceNodeId
    const prevTargetId = _nearbyTargetId
    pending = null
    _nearbyTargetId = null
    previewCandidate = null
    // Notify global listeners (isConnecting changed)
    globalListeners.forEach((fn) => fn())
    // Notify previously affected cards
    if (prevSourceId) notifyCardListeners(prevSourceId)
    if (prevTargetId) notifyCardListeners(prevTargetId)
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

    void sourcePos
    void sourceSize
    void targetPos
    void targetSize
    const snapped = previewCandidate?.targetNodeId === targetNodeId ? previewCandidate : null
    const sourceHandleId = snapped?.sourceHandleId ?? pending.sourceHandleId
    const finalTargetHandleId = snapped?.targetHandleId ?? targetHandleId

    const prevSourceId = pending.sourceNodeId
    const prevTargetId = _nearbyTargetId

    completeHandler({
      sourceNodeId: pending.sourceNodeId,
      sourceHandleId,
      targetNodeId,
      targetHandleId: finalTargetHandleId,
    })
    pending = null
    _nearbyTargetId = null
    previewCandidate = null
    // Notify global listeners (isConnecting changed)
    globalListeners.forEach((fn) => fn())
    // Notify previously affected cards
    if (prevSourceId) notifyCardListeners(prevSourceId)
    if (prevTargetId) notifyCardListeners(prevTargetId)
    notifyCardListeners(targetNodeId)
    return true
  },

  onComplete(handler: CompleteHandler) {
    completeHandler = handler
  },

  /**
   * Subscribe to global connection state changes (isConnecting).
   * Used by ReactFlowCanvas and CardNode's isConnecting subscription.
   */
  subscribe(fn: Listener): () => void {
    globalListeners.add(fn)
    return () => { globalListeners.delete(fn) }
  },

  /**
   * Subscribe to connection state changes for a specific card.
   * Only called when the card's isConnectingFrom or isNearbyTarget status may have changed.
   */
  subscribeCard(cardId: string, fn: Listener): () => void {
    let listeners = cardListeners.get(cardId)
    if (!listeners) {
      listeners = new Set<Listener>()
      cardListeners.set(cardId, listeners)
    }
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
      if (listeners.size === 0) {
        cardListeners.delete(cardId)
      }
    }
  },

  setNearbyTarget(nodeId: string | null) {
    if (_nearbyTargetId !== nodeId) {
      const prevTargetId = _nearbyTargetId
      _nearbyTargetId = nodeId
      // Only notify the previous and new target cards
      if (prevTargetId) notifyCardListeners(prevTargetId)
      if (nodeId) notifyCardListeners(nodeId)
    }
  },

  getNearbyTarget(): string | null {
    return _nearbyTargetId
  },

  setPreviewCandidate(candidate: ConnectionSnapCandidate | null) {
    previewCandidate = candidate
  },

  getPreviewCandidate(): ConnectionSnapCandidate | null {
    return previewCandidate
  },
}
