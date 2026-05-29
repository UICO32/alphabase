import { useEffect } from 'react'
import { useLibraryStore } from '../stores/libraryStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useEventBus } from '../stores/eventBus'

interface UseAppEventsOptions {
  dataReady: boolean
  setShowWorkspacePicker: (show: boolean) => void
}

export function useAppEvents({ dataReady, setShowWorkspacePicker }: UseAppEventsOptions) {
  const panelHue = useLibraryStore(s => s.panelHue)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)
  const emit = useEventBus(s => s.emit)

  useEffect(() => {
    const splash = document.getElementById('splash')
    if (splash) {
      splash.classList.add('fade-out')
      setTimeout(() => splash.remove(), 300)
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--panel-hue', String(panelHue))
    localStorage.setItem('hepta-panel-hue', String(panelHue))
  }, [panelHue])

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
}
