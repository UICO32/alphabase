import { useWorkspaceStore } from '../../stores/workspaceStore'
import { EmptyState } from './SharedUI'
import { Folder, Plus, Clock, X } from 'lucide-react'
import { emit } from '../../stores/eventBus'
import { Dialog, DialogClose, DialogContent, DialogTitle } from './shadcn/dialog'

interface WorkspacePickerProps {
  onClose: () => void
}

export function WorkspacePicker({ onClose }: WorkspacePickerProps) {
  const recentWorkspaces = useWorkspaceStore(s => s.recentWorkspaces)
  const setCurrentWorkspace = useWorkspaceStore(s => s.setCurrentWorkspace)

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent size="md" showCloseButton={false} className="flex max-h-[80vh] flex-col gap-0 overflow-hidden bg-surface-card p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <DialogTitle className="font-semibold text-fg-primary">
            选择工作区
          </DialogTitle>
          <DialogClose asChild>
            <button aria-label="关闭工作区选择" className="interactive-control focus-ring p-2 rounded-lg text-fg-secondary hover:text-fg-primary hover:bg-surface-panel-hover">
              <X size={18} />
            </button>
          </DialogClose>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <button
            onClick={handleCreateWorkspace}
            className="w-full flex items-center gap-3 p-4 rounded-lg mb-5 bg-surface-panel-hover hover:bg-surface-card-active transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-card group-hover:bg-surface-card-hover transition-colors">
              <Plus size={20} className="text-fg-secondary group-hover:text-accent-blue transition-colors" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-fg-primary">
                创建工作区
              </div>
              <div className="text-xs text-fg-tertiary">
                选择一个文件夹作为新的工作区
              </div>
            </div>
          </button>

          <div>
            <div className="flex items-center gap-2 mb-3 text-xs text-fg-tertiary">
              <Clock size={12} />
              <span>最近使用</span>
            </div>

            {recentWorkspaces.length === 0 ? (
              <EmptyState
                icon={<Folder size={32} />}
                text="暂无最近使用的工作区"
              />
            ) : (
              <div className="space-y-1.5">
                {recentWorkspaces.map((workspace) => (
                  <button
                    key={workspace.path}
                    onClick={() => handleSelectWorkspace(workspace)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-surface-panel-hover active:bg-surface-card-active transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-panel-hover">
                      <Folder size={16} className="text-fg-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-fg-primary">
                        {workspace.name}
                      </div>
                      <div className="text-xs truncate text-fg-tertiary">
                        {workspace.path}
                      </div>
                    </div>
                    <div className="text-xs text-fg-disabled shrink-0">
                      {new Date(workspace.lastOpened).toLocaleDateString('zh-CN')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
