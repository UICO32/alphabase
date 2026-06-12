import { useSyncExternalStore } from 'react'
import { useStoreApi } from '@xyflow/react'

const THRESHOLD = 0.5

export function useIsZoomedOut(): boolean {
  const store = useStoreApi()

  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().transform[2] < THRESHOLD,
  )
}