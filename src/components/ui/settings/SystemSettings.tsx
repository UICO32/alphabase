import { useIsDarkMode } from '../../../hooks/useIsDarkMode'
import { usePanelSurface } from '../../../hooks/usePanelSurface'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { Moon, Sun, FolderOpen } from 'lucide-react'

const PANEL_HUE_OPTIONS = [
  { hue: 0, label: '中性灰', light: '#f4f4f5', dark: '#111c31' },
  { hue: 210, label: '冷蓝灰', light: '#f0f4f8', dark: '#0f172a' },
  { hue: 30, label: '暖棕灰', light: '#f5f0eb', dark: '#1a1510' },
  { hue: 150, label: '冷绿灰', light: '#f0f5f2', dark: '#0f1a14' },
  { hue: 280, label: '冷紫灰', light: '#f3f0f5', dark: '#16101a' },
  { hue: 350, label: '暖红灰', light: '#f5f0f1', dark: '#1a1012' },
]

export function SystemSettings() {
  const isDarkMode = useIsDarkMode()
  const setDarkMode = useLibraryStore(s => s.setDarkMode)
  const panelHue = useLibraryStore(s => s.panelHue)
  const setPanelHue = useLibraryStore(s => s.setPanelHue)
  const surface = usePanelSurface()
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  return (
    <>
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4" style={{ color: surface.text }}>
          画布设置
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg transition-theme" style={{ backgroundColor: surface.surface }}>
            <span className="text-sm" style={{ color: surface.text }}>
              自动折叠卡片
            </span>
            <input type="checkbox" className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg transition-theme" style={{ backgroundColor: surface.surface }}>
            <span className="text-sm" style={{ color: surface.text }}>
              显示卡片库
            </span>
            <input type="checkbox" className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg transition-theme" style={{ backgroundColor: surface.surface }}>
            <span className="text-sm" style={{ color: surface.text }}>
              删除前确认
            </span>
            <input type="checkbox" className="w-4 h-4" defaultChecked />
          </label>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4" style={{ color: surface.text }}>
          主题设置
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setDarkMode(false)}
            className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-theme btn-base"
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
            className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-theme btn-base"
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

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4" style={{ color: surface.text }}>
          面板色调
        </h3>
        <div className="flex gap-2">
          {PANEL_HUE_OPTIONS.map(opt => (
            <button
              key={opt.hue}
              onClick={() => setPanelHue(opt.hue)}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg transition-theme btn-base"
              style={{
                backgroundColor: panelHue === opt.hue ? surface.surface : 'transparent',
                border: panelHue === opt.hue ? `1px solid ${surface.divider}` : '1px solid transparent',
              }}
            >
              <div
                className="w-8 h-8 rounded-md"
                style={{ backgroundColor: isDarkMode ? opt.dark : opt.light, border: `1px solid ${surface.divider}` }}
              />
              <span className="text-xs" style={{ color: panelHue === opt.hue ? surface.text : surface.muted }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4" style={{ color: surface.text }}>
          工作区设置
        </h3>
        <div className="space-y-3">
          <button className="btn-base flex items-center justify-between p-3 rounded-lg w-full" style={{ backgroundColor: surface.surface }}>
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
    </>
  )
}
