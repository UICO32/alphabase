import { useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useBoardStore } from '../../stores/boardStore'
import { useViewStore } from '../../stores/viewStore'

export function TitleBar() {
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)
  const activeBoardId = useBoardStore(s => s.activeBoardId)
  const boards = useBoardStore(s => s.boards)
  const viewMode = useViewStore(s => s.viewMode)
  const [isMaximized, setIsMaximized] = useState(false)

  const activeBoardName = useMemo(() => {
    if (viewMode !== 'board' || !activeBoardId) return null
    return boards.find(b => b.id === activeBoardId)?.name ?? null
  }, [viewMode, activeBoardId, boards])

  const handleMinimize = useCallback(() => {
    window.electronAPI?.window?.minimize()
  }, [])

  const handleMaximize = useCallback(async () => {
    await window.electronAPI?.window?.maximize()
    const maximized = await window.electronAPI?.window?.isMaximized()
    setIsMaximized(!!maximized)
  }, [])

  const handleClose = useCallback(() => {
    window.electronAPI?.window?.close()
  }, [])

  return (
    <div
      className="flex items-center h-6 shrink-0 select-none bg-transparent"
      style={{
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 px-4 min-w-0" style={{ width: 260 }}>
        <span className="text-xs truncate text-fg-secondary">
          {currentWorkspace?.name || 'Heptabase'}
        </span>
        {activeBoardName && (
          <>
            <span className="text-xs text-fg-tertiary select-none">/</span>
            <span className="text-xs truncate text-fg-primary font-medium">
              {activeBoardName}
            </span>
          </>
        )}
      </div>
      <div className="flex-1" />

      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="window-btn flex items-center justify-center h-full px-2.5 text-fg-secondary hover:bg-surface-panel-hover transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="window-btn flex items-center justify-center h-full px-2.5 text-fg-secondary hover:bg-surface-panel-hover transition-colors"
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" rx="0.5" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" fill="var(--surface-panel)" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="window-btn window-btn-close flex items-center justify-center h-full px-2.5 text-fg-secondary transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  )
}
