import { useEffect } from 'react'
import { on } from '../stores/eventBus'
import type { EventMap, EventKey } from '../stores/eventBus'

export function useEvent<K extends EventKey>(
  event: K,
  handler: (detail: EventMap[K]) => void,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    return on(event, handler)
  }, [on, event, ...deps])
}
