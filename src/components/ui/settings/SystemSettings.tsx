import { useThemeStore } from '../../../stores/themeStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { Moon, Sun, Monitor, FolderOpen } from 'lucide-react'
import { VectorIndexSettings } from './VectorIndexSettings'
import { ToggleGroup, ToggleGroupItem } from '../shadcn/toggle-group'
import { Switch } from '../shadcn/switch'
import { Button } from '../shadcn/button'
import { SettingGroup, SettingRow } from './SettingPrimitives'
import { setAccentColor, getAccentColor } from '../../../theme'
import type { GridPattern } from '../../canvas/AdaptiveBackground'
import { useState } from 'react'

const GRID_PATTERNS: { value: GridPattern; label: string }[] = [
  { value: 'cross', label: '十字' },
  { value: 'dot', label: '方块' },
  { value: 'circle', label: '圆形' },
  { value: 'triangle', label: '三角' },
]

const THEME_MODES = [
  { value: 'light' as const, label: '浅色', icon: Sun },
  { value: 'dark' as const, label: '深色', icon: Moon },
  { value: 'system' as const, label: '跟随系统', icon: Monitor },
]

const ACCENT_PRESETS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
]

export function SystemSettings() {
  const themeMode = useThemeStore(s => s.themeMode)
  const setThemeMode = useThemeStore(s => s.setThemeMode)
  const gridPattern = useThemeStore(s => s.gridPattern)
  const setGridPattern = useThemeStore(s => s.setGridPattern)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)
  const settings = useWorkspaceStore(s => s.settings)
  const updateSettings = useWorkspaceStore(s => s.updateSettings)

  const [accentColor, setAccentColorState] = useState(getAccentColor())

  const handleAccentChange = (color: string) => {
    setAccentColor(color)
    setAccentColorState(color)
  }

  const handleResetAccent = () => {
    setAccentColor(null)
    setAccentColorState(null)
  }

  return (
    <>
      <SettingGroup title="外观">
        <SettingRow label="主题模式">
          <ToggleGroup
            type="single"
            value={themeMode}
            onValueChange={(v) => { if (v) setThemeMode(v as typeof themeMode) }}
            className="w-[260px]"
          >
            {THEME_MODES.map((m) => {
              const Icon = m.icon
              return (
                <ToggleGroupItem key={m.value} value={m.value}>
                  <Icon size={14} /><span>{m.label}</span>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </SettingRow>
        <SettingRow label="强调色" description="应用于标签、链接、选中态与聚焦环">
          <div className="flex items-center gap-1.5">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => handleAccentChange(c)}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: accentColor === c ? 'var(--fg-primary)' : 'transparent',
                }}
              />
            ))}
            <label className="w-5 h-5 rounded-full border-2 border-line-default cursor-pointer overflow-hidden relative hover:scale-110 transition-transform">
              <input
                type="color"
                value={accentColor ?? '#2563eb'}
                onChange={(e) => handleAccentChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] text-fg-tertiary">+</span>
            </label>
            {accentColor && (
              <Button variant="ghost" size="icon" onClick={handleResetAccent} className="h-5 w-5" title="恢复默认">
                <span className="text-xs text-fg-tertiary">×</span>
              </Button>
            )}
          </div>
        </SettingRow>
        <SettingRow label="背景图案">
          <ToggleGroup
            type="single"
            value={gridPattern}
            onValueChange={(v) => { if (v) setGridPattern(v as GridPattern) }}
            className="w-[200px]"
          >
            {GRID_PATTERNS.map((p) => (
              <ToggleGroupItem key={p.value} value={p.value}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingRow>
        <SettingRow label="删除前确认">
          <Switch
            checked={settings.confirmDelete}
            onCheckedChange={(v) => updateSettings({ confirmDelete: v })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="工作区">
        <SettingRow label="当前工作区" description={currentWorkspace?.name ?? undefined}>
          <FolderOpen size={16} className="text-fg-tertiary" />
        </SettingRow>
      </SettingGroup>

      <VectorIndexSettings />
    </>
  )
}
