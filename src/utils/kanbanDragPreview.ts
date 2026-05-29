export interface KanbanPreviewRect {
  localX: number
  localY: number
  width: number
  height: number
  frameId: string
}

type Listener = () => void

let previewRect: KanbanPreviewRect | null = null
const listeners: Set<Listener> = new Set()

function notify() {
  listeners.forEach((fn) => fn())
}

export const kanbanDragPreview = {
  set(rect: KanbanPreviewRect | null) {
    previewRect = rect
    notify()
  },
  get(): KanbanPreviewRect | null {
    return previewRect
  },
  clear() {
    previewRect = null
    notify()
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}