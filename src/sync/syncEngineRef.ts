import type { WorkspaceSyncEngine } from './workspace/syncEngine'

let activeEngine: WorkspaceSyncEngine | null = null

export function setActiveSyncEngine(engine: WorkspaceSyncEngine | null) {
  activeEngine = engine
}

export function getActiveSyncEngine(): WorkspaceSyncEngine | null {
  return activeEngine
}

export async function stopActiveSyncEngine() {
  if (activeEngine) {
    const engine = activeEngine
    activeEngine = null
    await engine.stop()
  }
}