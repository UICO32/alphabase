import { useEffect } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { emit } from '../stores/eventBus'

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
      try { sessionStorage.setItem('hepta-startup-total', String(totalMs)) } catch {}
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

  // Flush sync engine before window closes to prevent data loss
  useEffect(() => {
    const syncFlush = async () => {
      const engine = (window as any).__activeSyncEngine
      if (engine?.flushAll) {
        await engine.flushAll()
      }
    }

    // Quick flush for beforeunload/pagehide (may not complete)
    const quickFlush = () => {
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
