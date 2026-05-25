type EventMap = {
  'hepta-add-card-node': { cardId: string; color: string }
  'hepta-switch-board': { boardId: string }
  'hepta-save-current-board': undefined
  'hepta-data-ready': undefined
  'hepta-reinit-workspace': undefined
  'hepta-workspace-changed': { path: string }
  'hepta-focus-card': { cardId: string }
  'hepta-zoom-in': undefined
  'hepta-zoom-out': undefined
  'hepta-fit-view': undefined
  'hepta-select-folder': undefined
  'hepta-open-in-explorer': { path: string }
}

type Listener<T> = (detail: T) => void

const listeners = new Map<string, Set<Listener<unknown>>>()

export const appEvents = {
  emit<K extends keyof EventMap>(name: K, detail?: EventMap[K]) {
    const set = listeners.get(name)
    if (set) {
      set.forEach((fn) => fn(detail))
    }
  },

  on<K extends keyof EventMap>(name: K, fn: Listener<EventMap[K]>): () => void {
    let set = listeners.get(name)
    if (!set) {
      set = new Set()
      listeners.set(name, set)
    }
    set.add(fn as Listener<unknown>)
    return () => {
      set!.delete(fn as Listener<unknown>)
      if (set!.size === 0) listeners.delete(name)
    }
  },
}