import type { WorkspaceSyncEngine } from './syncEngine'

let activeEngine: WorkspaceSyncEngine | null = null

export function setActiveSyncEngine(engine: WorkspaceSyncEngine | null) {
  activeEngine = engine
  // Expose for beforeunload synchronous flush
  ;(window as any).__activeSyncEngine = engine
}

export function getActiveSyncEngine(): WorkspaceSyncEngine | null {
  return activeEngine
}

export async function flushActiveSyncEngine() {
  if (activeEngine) {
    await activeEngine.flushAll()
  }
}

export async function stopActiveSyncEngine() {
  if (activeEngine) {
    const engine = activeEngine
    activeEngine = null
    ;(window as any).__activeSyncEngine = null
    await engine.stop()
  }
}