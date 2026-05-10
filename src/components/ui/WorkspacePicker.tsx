import { useState } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useWorkspaceStore } from '../../utils/workspace/workspaceStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { EmptyState } from './SharedUI'
import { Folder, Plus, Clock, X } from 'lucide-react'

interface WorkspacePickerProps {
  onClose: () => void
}

export function WorkspacePicker({ onClose }: WorkspacePickerProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)
  const recentWorkspaces = useWorkspaceStore(s => s.recentWorkspaces)
  const setCurrentWorkspace = useWorkspaceStore(s => s.setCurrentWorkspace)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleSelectWorkspace = (workspace: { path: string; name: string; lastOpened: number }) => {
    setCurrentWorkspace({
      path: workspace.path,
      name: workspace.name,
      lastOpened: Date.now(),
    })
    onClose()
  }

  const handleCreateWorkspace = () => {
    setShowCreateDialog(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-[500px] max-h-[80vh] rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: surface.panelBg }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: surface.divider }}
        >
          <span className="font-semibold" style={{ color: surface.text }}>
            选择工作区
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: surface.muted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 创建新工作区 */}
          <button
            onClick={handleCreateWorkspace}
            className="w-full flex items-center gap-3 p-4 rounded-xl mb-6 transition-colors"
            style={{
              backgroundColor: surface.surface,
              border: `1px dashed ${surface.divider}`,
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: surface.panelBg }}
            >
              <Plus size={20} style={{ color: surface.text }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: surface.text }}>
                创建工作区
              </div>
              <div className="text-xs" style={{ color: surface.muted }}>
                选择一个文件夹作为新的工作区
              </div>
            </div>
          </button>

          {/* 最近工作区 */}
          <div>
            <div
              className="flex items-center gap-2 mb-3 text-xs"
              style={{ color: surface.muted }}
            >
              <Clock size={12} />
              <span>最近使用</span>
            </div>

            {recentWorkspaces.length === 0 ? (
              <EmptyState
                icon={<Folder size={32} />}
                text="暂无最近使用的工作区"
                surface={surface}
              />
            ) : (
              <div className="space-y-2">
                {recentWorkspaces.map((workspace) => (
                  <button
                    key={workspace.path}
                    onClick={() => handleSelectWorkspace(workspace)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
                    style={{
                      backgroundColor: surface.surface,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: surface.panelBg }}
                    >
                      <Folder size={16} style={{ color: surface.muted }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-medium truncate"
                        style={{ color: surface.text }}
                      >
                        {workspace.name}
                      </div>
                      <div
                        className="text-xs truncate"
                        style={{ color: surface.muted }}
                      >
                        {workspace.path}
                      </div>
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: surface.muted }}
                    >
                      {new Date(workspace.lastOpened).toLocaleDateString('zh-CN')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建工作区对话框 */}
      {showCreateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowCreateDialog(false)}
        >
          <div
            className="w-[400px] rounded-xl shadow-2xl p-6"
            style={{ backgroundColor: surface.panelBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: surface.text }}
            >
              创建工作区
            </h3>
            <p className="text-sm mb-4" style={{ color: surface.muted }}>
              选择一个文件夹作为工作区，或者创建一个新的文件夹。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('hepta-select-folder'))
                  setShowCreateDialog(false)
                  onClose()
                }}
                className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                }}
              >
                选择文件夹
              </button>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: surface.surface,
                  color: surface.text,
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
