import { useEffect } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { emit, on } from '../stores/eventBus'
import { auditWorkspaceHealth } from '../utils/workspace/audit'
import { notifyError } from '../utils/notify'

interface UseAppEventsOptions {
  dataReady: boolean
  setShowWorkspacePicker: (show: boolean) => void
}

export function useAppEvents({ dataReady, setShowWorkspacePicker }: UseAppEventsOptions) {
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  // Dismiss splash when dataReady (splash handles its own 2s min display time)
  useEffect(() => {
    if (!dataReady) return
    const dismiss = (window as any).__dismissSplash
    if (dismiss) dismiss()
    const appStart = (window as any).__appStartTs
    if (appStart) {
      const totalMs = Math.round(performance.now() - appStart)
      console.log(`[startup] total render→ready: ${totalMs}ms`)
      try { sessionStorage.setItem('hepta-startup-total', String(totalMs)) } catch { /* sessionStorage may be unavailable */ }
    }
  }, [dataReady])

  useEffect(() => {
    if (dataReady) {
      emit('data-ready', undefined)
    }
  }, [dataReady, emit])

  useEffect(() => {
    const savedPath = localStorage.getItem('hepta-last-workspace-path')
    if (savedPath && !currentWorkspace) {
      const name = savedPath.split(/[\\/]/).filter(Boolean).pop() || '未命名工作区'
      useWorkspaceStore.getState().setCurrentWorkspace({
        path: savedPath,
        name,
        lastOpened: Date.now(),
      })
      useWorkspaceStore.getState().addRecentWorkspace({
        path: savedPath,
        name,
        lastOpened: Date.now(),
      })
    }
  }, [])

  useEffect(() => {
    const savedPath = localStorage.getItem('hepta-last-workspace-path')
    if (!currentWorkspace && !savedPath) {
      setShowWorkspacePicker(true)
    }
  }, [currentWorkspace, setShowWorkspacePicker])

  // 监听 syncEngine 的 write-error：写入失败必须向用户反馈，否则数据会静默丢失。
  // 节流避免短时间内大量写入失败刷屏。
  useEffect(() => {
    let lastToast = 0
    let errorCount = 0
    const THROTTLE_MS = 3000

    const unsub = on('write-error', ({ path, error }) => {
      console.error('[write-error]', path, error)
      errorCount++
      const now = Date.now()
      if (now - lastToast < THROTTLE_MS) return
      lastToast = now
      const count = errorCount
      errorCount = 0
      notifyError(
        count > 1
          ? `${count} 个文件写入失败，数据可能未保存`
          : `文件写入失败：${error}`,
        { duration: 6000 }
      )
    })
    return () => unsub()
  }, [])

  // Flush sync engine before window closes to prevent data loss
  useEffect(() => {
    const syncFlush = async () => {
      const workspacePath = localStorage.getItem('hepta-last-workspace-path')
      if (workspacePath) await auditWorkspaceHealth(workspacePath, 'flush-before-close-before')
      const engine = (window as any).__activeSyncEngine
      if (engine?.flushAll) {
        await engine.flushAll()
      }
      if (workspacePath) await auditWorkspaceHealth(workspacePath, 'flush-before-close-after')
    }

    // Quick flush for beforeunload/pagehide (may not complete)
    const quickFlush = () => {
      const workspacePath = localStorage.getItem('hepta-last-workspace-path')
      if (workspacePath) void auditWorkspaceHealth(workspacePath, 'quick-flush-before-unload')
      const engine = (window as any).__activeSyncEngine
      if (engine?.flushNow) {
        engine.flushNow()
      }
    }

    window.addEventListener('beforeunload', quickFlush)
    window.addEventListener('pagehide', quickFlush)

    // Full async flush for Electron close signal — waits for all writes
    const cleanup = (window as any).electronAPI?.onFlushBeforeClose?.(syncFlush)

    return () => {
      window.removeEventListener('beforeunload', quickFlush)
      window.removeEventListener('pagehide', quickFlush)
      cleanup?.()
    }
  }, [])
}
