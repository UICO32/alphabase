import { useThemeStore } from '../../../stores/themeStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { Moon, Sun, Monitor, FolderOpen } from 'lucide-react'
import { VectorIndexSettings } from './VectorIndexSettings'
import type { GridPattern } from '../../canvas/AdaptiveBackground'

const GRID_PATTERNS: { value: GridPattern; label: string }[] = [
  { value: 'cross', label: '十字' },
  { value: 'dot', label: '方块' },
  { value: 'circle', label: '圆形' },
  { value: 'triangle', label: '三角' },
]

export function SystemSettings() {
  const themeMode = useThemeStore(s => s.themeMode)
  const setThemeMode = useThemeStore(s => s.setThemeMode)
  const gridPattern = useThemeStore(s => s.gridPattern)
  const setGridPattern = useThemeStore(s => s.setGridPattern)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)
  const settings = useWorkspaceStore(s => s.settings)
  const updateSettings = useWorkspaceStore(s => s.updateSettings)

  return (
    <>
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-fg-primary">
          画布设置
        </h3>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-fg-primary block mb-2">背景图案</span>
            <div className="flex gap-2">
              {GRID_PATTERNS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setGridPattern(p.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                    gridPattern === p.value
                      ? 'bg-emphasis text-fg-inverse'
                      : 'bg-surface-panel-hover text-fg-primary hover:bg-surface-card-active'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between p-3 rounded-lg bg-surface-panel-hover cursor-pointer hover:bg-surface-card-active transition-colors">
            <span className="text-sm text-fg-primary">
              删除前确认
            </span>
            <input
              type="checkbox"
              className="w-4 h-4 accent-accent-blue"
              checked={settings.confirmDelete}
              onChange={(e) => updateSettings({ confirmDelete: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-fg-primary">
          主题设置
        </h3>
        <div className="flex gap-3">
          <ThemeButton
            active={themeMode === 'light'}
            onClick={() => setThemeMode('light')}
            icon={<Sun size={18} />}
            label="浅色"
          />
          <ThemeButton
            active={themeMode === 'dark'}
            onClick={() => setThemeMode('dark')}
            icon={<Moon size={18} />}
            label="深色"
          />
          <ThemeButton
            active={themeMode === 'system'}
            onClick={() => setThemeMode('system')}
            icon={<Monitor size={18} />}
            label="跟随系统"
          />
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-fg-primary">
          工作区设置
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-panel-hover">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-fg-tertiary" />
              <span className="text-sm text-fg-primary">
                当前工作区
              </span>
            </div>
            <span className="text-xs truncate max-w-[200px] text-fg-tertiary">
              {currentWorkspace?.name || '未选择'}
            </span>
          </div>
        </div>
      </div>

      <VectorIndexSettings />
    </>
  )
}

function ThemeButton({ active, onClick, icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-colors ${
        active
          ? 'bg-emphasis text-fg-inverse'
          : 'bg-surface-panel-hover text-fg-primary hover:bg-surface-card-active'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
