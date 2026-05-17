import { useWorkspaceStore } from '../../utils/workspace/workspaceStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'

export function TitleBar() {
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)
  const surface = usePanelSurface()

  return (
    <div
      className="flex items-center h-7 shrink-0 select-none"
      style={{
        WebkitAppRegion: 'drag',
        backgroundColor: surface.panelBg,
        paddingRight: 138,
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 px-4 min-w-0" style={{ width: 260 }}>
        <span className="text-xs truncate" style={{ color: surface.muted }}>
          {currentWorkspace?.name || 'Heptabase'}
        </span>
      </div>
      <div className="flex-1" />
    </div>
  )
}
