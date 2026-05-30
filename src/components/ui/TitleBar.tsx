import { useWorkspaceStore } from '../../stores/workspaceStore'

export function TitleBar() {
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  return (
    <div
      className="flex items-center h-7 shrink-0 select-none glass-panel"
      style={{
        WebkitAppRegion: 'drag',
        paddingRight: 138,
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 px-4 min-w-0" style={{ width: 260 }}>
        <span className="text-xs truncate text-text-secondary">
          {currentWorkspace?.name || 'Heptabase'}
        </span>
      </div>
      <div className="flex-1" />
    </div>
  )
}
