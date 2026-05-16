import type { WorkspaceSyncEngine } from './workspace/syncEngine'

let activeEngine: WorkspaceSyncEngine | null = null

export function setActiveSyncEngine(engine: WorkspaceSyncEngine | null) {
  activeEngine = engine
}

export function getActiveSyncEngine(): WorkspaceSyncEngine | null {
  return activeEngine
}

export function stopActiveSyncEngine() {
  if (activeEngine) {
    activeEngine.stop()
    activeEngine = null
  }
}