import { useLibraryStore } from '../../utils/libraryStore'
import { useWorkspaceStore } from '../../utils/workspace/workspaceStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { X, Moon, Sun, Download, Upload, FolderOpen } from 'lucide-react'

interface SettingsDialogProps {
  onClose: () => void
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const setDarkMode = useLibraryStore(s => s.setDarkMode)
  const surface = getPanelSurface(isDarkMode)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-[700px] max-h-[80vh] rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: surface.panelBg }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: surface.divider }}
        >
          <span className="font-semibold" style={{ color: surface.text }}>
            设置
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: surface.muted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 设置内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 画布设置 */}
          <div className="mb-8">
            <h3
              className="text-sm font-medium mb-4"
              style={{ color: surface.text }}
            >
              画布设置
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: surface.surface }}>
                <span className="text-sm" style={{ color: surface.text }}>
                  自动折叠卡片
                </span>
                <input type="checkbox" className="w-4 h-4" />
              </label>
              <label className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: surface.surface }}>
                <span className="text-sm" style={{ color: surface.text }}>
                  显示卡片库
                </span>
                <input type="checkbox" className="w-4 h-4" />
              </label>
              <label className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: surface.surface }}>
                <span className="text-sm" style={{ color: surface.text }}>
                  删除前确认
                </span>
                <input type="checkbox" className="w-4 h-4" defaultChecked />
              </label>
            </div>
          </div>

          {/* 主题设置 */}
          <div className="mb-8">
            <h3
              className="text-sm font-medium mb-4"
              style={{ color: surface.text }}
            >
              主题设置
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setDarkMode(false)}
                className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-colors"
                style={{
                  backgroundColor: !isDarkMode ? surface.text : surface.surface,
                  color: !isDarkMode ? surface.panelBg : surface.text,
                  border: `1px solid ${surface.divider}`,
                }}
              >
                <Sun size={18} />
                <span>浅色</span>
              </button>
              <button
                onClick={() => setDarkMode(true)}
                className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-colors"
                style={{
                  backgroundColor: isDarkMode ? surface.text : surface.surface,
                  color: isDarkMode ? surface.panelBg : surface.text,
                  border: `1px solid ${surface.divider}`,
                }}
              >
                <Moon size={18} />
                <span>深色</span>
              </button>
            </div>
          </div>

          {/* 工作区设置 */}
          <div className="mb-8">
            <h3
              className="text-sm font-medium mb-4"
              style={{ color: surface.text }}
            >
              工作区设置
            </h3>
            <div className="space-y-3">
              <button
                className="flex items-center justify-between p-3 rounded-lg w-full"
                style={{ backgroundColor: surface.surface }}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} style={{ color: surface.muted }} />
                  <span className="text-sm" style={{ color: surface.text }}>
                    当前工作区
                  </span>
                </div>
                <span className="text-sm" style={{ color: surface.muted }}>
                  {currentWorkspace?.path || '未设置'}
                </span>
              </button>
            </div>
          </div>

          {/* 导入导出 */}
          <div>
            <h3
              className="text-sm font-medium mb-4"
              style={{ color: surface.text }}
            >
              导入导出
            </h3>
            <div className="flex gap-3">
              <button
                className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-colors"
                style={{
                  backgroundColor: surface.surface,
                  color: surface.text,
                  border: `1px solid ${surface.divider}`,
                }}
              >
                <Download size={18} />
                <span>导出数据</span>
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-colors"
                style={{
                  backgroundColor: surface.surface,
                  color: surface.text,
                  border: `1px solid ${surface.divider}`,
                }}
              >
                <Upload size={18} />
                <span>导入数据</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
