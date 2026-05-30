import { useLibraryStore } from '../../../stores/libraryStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { Moon, Sun, Monitor, FolderOpen } from 'lucide-react'
import { VectorIndexSettings } from './VectorIndexSettings'

export function SystemSettings() {
  const themeMode = useLibraryStore(s => s.themeMode)
  const setThemeMode = useLibraryStore(s => s.setThemeMode)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  return (
    <>
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-text-primary">
          画布设置
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg transition-theme bg-surface-card">
            <span className="text-sm text-text-primary">
              自动折叠卡片
            </span>
            <input type="checkbox" className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg transition-theme bg-surface-card">
            <span className="text-sm text-text-primary">
              显示卡片库
            </span>
            <input type="checkbox" className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg transition-theme bg-surface-card">
            <span className="text-sm text-text-primary">
              删除前确认
            </span>
            <input type="checkbox" className="w-4 h-4" defaultChecked />
          </label>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-text-primary">
          主题设置
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setThemeMode('light')}
            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-theme btn-base border border-border-default ${themeMode === 'light' ? 'bg-text-primary text-text-inverse' : 'bg-surface-card text-text-primary'}`}
          >
            <Sun size={18} />
            <span>浅色</span>
          </button>
          <button
            onClick={() => setThemeMode('dark')}
            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-theme btn-base border border-border-default ${themeMode === 'dark' ? 'bg-text-primary text-text-inverse' : 'bg-surface-card text-text-primary'}`}
          >
            <Moon size={18} />
            <span>深色</span>
          </button>
          <button
            onClick={() => setThemeMode('system')}
            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-theme btn-base border border-border-default ${themeMode === 'system' ? 'bg-text-primary text-text-inverse' : 'bg-surface-card text-text-primary'}`}
          >
            <Monitor size={18} />
            <span>跟随系统</span>
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-text-primary">
          工作区设置
        </h3>
        <div className="space-y-3">
          <button className="btn-base flex items-center justify-between p-3 rounded-lg w-full bg-surface-card">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-text-secondary" />
              <span className="text-sm text-text-primary">
                当前工作区
              </span>
            </div>
            <span className="text-xs truncate max-w-[200px] text-text-secondary">
              {currentWorkspace?.name || '未选择'}
            </span>
          </button>
        </div>
      </div>

      <VectorIndexSettings />
    </>
  )
}
