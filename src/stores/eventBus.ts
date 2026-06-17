import { create } from 'zustand'

export type EventMap = {
  'data-ready': undefined
  'switch-board': { boardId: string }
  'save-current-board': undefined
  'reinit-workspace': undefined
  'workspace-changed': { path: string }
  'select-folder': undefined
  'add-card-node': { cardId: string; color: string }
  'focus-card': { cardId: string }
  'remove-card-from-board': { cardId: string; cardContent: unknown }
  'open-in-explorer': { path: string }
  'write-error': { path: string; error: string }
  'startup-progress': { step: string; progress: number; total: number }
  'zoom-in': undefined
  'zoom-out': undefined
  'fit-view': undefined
}

export type EventKey = keyof EventMap

type Listener<T> = (detail: T) => void

interface EventBusState {
  emit<K extends EventKey>(event: K, detail: EventMap[K]): void
  on<K extends EventKey>(event: K, listener: Listener<EventMap[K]>): () => void
}

const listeners = new Map<string, Set<Listener<unknown>>>()

export const useEventBus = create<EventBusState>(() => ({
  emit<K extends EventKey>(event: K, detail: EventMap[K]) {
    const set = listeners.get(event)
    if (set) {
      for (const fn of set) {
        fn(detail)
      }
    }
  },
  on<K extends EventKey>(event: K, listener: Listener<EventMap[K]>): () => void {
    let set = listeners.get(event)
    if (!set) {
      set = new Set()
      listeners.set(event, set)
    }
    set.add(listener as Listener<unknown>)
    return () => {
      set!.delete(listener as Listener<unknown>)
      if (set!.size === 0) listeners.delete(event)
    }
  },
}))
