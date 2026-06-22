import type { WorkspaceSyncEngine } from './syncEngine'

let activeEngine: WorkspaceSyncEngine | null = null

export function setActiveSyncEngine(engine: WorkspaceSyncEngine | null) {
  // 切换引擎时停止旧引擎：旧引擎若有未完成的 pending writes 会继续持有 timer，
  // 可能向已失效的目录写入或与新引擎的写入竞争，导致数据损坏。
  if (activeEngine && activeEngine !== engine) {
    activeEngine.stop().catch(() => { /* noop — 旧引擎停止失败不影响新引擎 */ })
  }
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