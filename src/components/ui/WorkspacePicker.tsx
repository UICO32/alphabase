import { useWorkspaceStore } from '../../stores/workspaceStore'
import { EmptyState } from './SharedUI'
import { Folder, Plus, Clock, X } from 'lucide-react'
import { useEventBus } from '../../stores/eventBus'

interface WorkspacePickerProps {
  onClose: () => void
}

export function WorkspacePicker({ onClose }: WorkspacePickerProps) {
  const recentWorkspaces = useWorkspaceStore(s => s.recentWorkspaces)
  const setCurrentWorkspace = useWorkspaceStore(s => s.setCurrentWorkspace)
  const emit = useEventBus(s => s.emit)

  const handleSelectWorkspace = (workspace: { path: string; name: string; lastOpened: number }) => {
    setCurrentWorkspace({
      path: workspace.path,
      name: workspace.name,
      lastOpened: Date.now(),
    })
    localStorage.setItem('hepta-last-workspace-path', workspace.path)
    emit('workspace-changed', { path: workspace.path })
    onClose()
  }

  const handleCreateWorkspace = () => {
    emit('select-folder', undefined)
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
      onClick={onClose}
    >
      <div
        className="modal-content w-[500px] max-h-[80vh] rounded-xl flex flex-col animate-scaleIn glass-panel"
        style={{
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b transition-theme border-border-default"
        >
          <span className="font-semibold text-text-primary">
            选择工作区
          </span>
          <button
            onClick={onClose}
            className="btn-base p-2 rounded-lg text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <button
            onClick={handleCreateWorkspace}
            className="btn-base w-full flex items-center gap-3 p-4 rounded-xl mb-6 bg-surface-card border border-dashed border-border-default"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-panel"
            >
              <Plus size={20} className="text-text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">
                创建工作区
              </div>
              <div className="text-xs text-text-secondary">
                选择一个文件夹作为新的工作区
              </div>
            </div>
          </button>

          <div>
            <div className="flex items-center gap-2 mb-3 text-xs text-text-secondary">
              <Clock size={12} />
              <span>最近使用</span>
            </div>

            {recentWorkspaces.length === 0 ? (
              <EmptyState
                icon={<Folder size={32} />}
                text="暂无最近使用的工作区"
              />
            ) : (
              <div className="space-y-2">
                {recentWorkspaces.map((workspace) => (
                  <button
                    key={workspace.path}
                    onClick={() => handleSelectWorkspace(workspace)}
                    className="hepta-list-item w-full flex items-center gap-3 p-3 rounded-lg text-left bg-surface-card"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-panel"
                    >
                      <Folder size={16} className="text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-text-primary">
                        {workspace.name}
                      </div>
                      <div className="text-xs truncate text-text-secondary">
                        {workspace.path}
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary">
                      {new Date(workspace.lastOpened).toLocaleDateString('zh-CN')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
