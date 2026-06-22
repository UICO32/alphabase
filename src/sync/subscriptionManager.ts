import type { WorkspaceSyncEngine } from './syncEngine'
import { subscribeCardStore, subscribeBoardStore, subscribeTrashStore } from './subscribeStores'

// store→磁盘的订阅必须独立于任何组件生命周期。
// 之前放在 ReactFlowCanvas/useWorkspaceLifecycle 里，视图切换导致组件卸载时订阅被清理且永不重建。
// 提升到模块级，由 useWorkspaceDataLoader 在数据加载后设置、App.tsx 在切换工作区时清理。
let unsubs: Array<() => void> | null = null

export function setupSubscriptions(syncEngine: WorkspaceSyncEngine): void {
  cleanupSubscriptions()
  unsubs = [
    subscribeCardStore(syncEngine),
    subscribeBoardStore(syncEngine),
    subscribeTrashStore(syncEngine),
  ]
}

export function cleanupSubscriptions(): void {
  if (unsubs) {
    for (const fn of unsubs) {
      try { fn() } catch { /* noop */ }
    }
    unsubs = null
  }
}
