/**
 * A tiny singleton that tracks the most recently created card id.
 * CardShapeComponent reads this once on mount to trigger auto-focus,
 * then clears it so subsequent renders don't re-focus.
 */
let pendingAutoFocusId: string | null = null
let draggedLibraryCardId: string | null = null
let pendingConnectionSourceId: string | null = null
const pendingConnectionListeners = new Set<() => void>()

function notifyPendingConnectionListeners() {
  pendingConnectionListeners.forEach((listener) => listener())
}

export function setPendingAutoFocus(id: string) {
  pendingAutoFocusId = id
}

export function consumePendingAutoFocus(id: string): boolean {
  if (pendingAutoFocusId === id) {
    pendingAutoFocusId = null
    return true
  }
  return false
}

export function setDraggedLibraryCardId(id: string | null) {
  draggedLibraryCardId = id
}

export function getDraggedLibraryCardId() {
  return draggedLibraryCardId
}

export function clearDraggedLibraryCardId() {
  draggedLibraryCardId = null
}

export function setPendingConnectionSourceId(id: string | null) {
  pendingConnectionSourceId = id
  notifyPendingConnectionListeners()
}

export function getPendingConnectionSourceId() {
  return pendingConnectionSourceId
}

export function clearPendingConnectionSourceId() {
  if (pendingConnectionSourceId === null) return
  pendingConnectionSourceId = null
  notifyPendingConnectionListeners()
}

export function subscribePendingConnectionSource(listener: () => void) {
  pendingConnectionListeners.add(listener)
  return () => {
    pendingConnectionListeners.delete(listener)
  }
}
