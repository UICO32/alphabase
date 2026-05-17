import { useState, useEffect } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useWorkspaceStore } from '../../utils/workspace/workspaceStore'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { useFlomoSyncStore } from '../../utils/flomoSync'
import { X, Moon, Sun, Download, Upload, FolderOpen, RefreshCw, LogOut, Link } from 'lucide-react'

const PANEL_HUE_OPTIONS = [
  { hue: 0, label: '中性灰', light: '#f4f4f5', dark: '#111c31' },
  { hue: 210, label: '冷蓝灰', light: '#f0f4f8', dark: '#0f172a' },
  { hue: 30, label: '暖棕灰', light: '#f5f0eb', dark: '#1a1510' },
  { hue: 150, label: '冷绿灰', light: '#f0f5f2', dark: '#0f1a14' },
  { hue: 280, label: '冷紫灰', light: '#f3f0f5', dark: '#16101a' },
  { hue: 350, label: '暖红灰', light: '#f5f0f1', dark: '#1a1012' },
]

type SettingsTab = 'system' | 'sync' | 'export'

interface SettingsDialogProps {
  onClose: () => void
  initialTab?: SettingsTab
}

export function SettingsDialog({ onClose, initialTab = 'system' }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const isDarkMode = useIsDarkMode()
  const setDarkMode = useLibraryStore(s => s.setDarkMode)
  const panelHue = useLibraryStore(s => s.panelHue)
  const setPanelHue = useLibraryStore(s => s.setPanelHue)
  const surface = usePanelSurface()
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
      onClick={onClose}
    >
      <div
        className="modal-content w-[700px] max-h-[80vh] rounded-xl flex flex-col animate-scaleIn"
        style={{
          backgroundColor: surface.panelBg,
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b transition-theme"
          style={{ borderColor: surface.divider }}
        >
          <span className="font-semibold" style={{ color: surface.text }}>
            设置
          </span>
          <button
            onClick={onClose}
            className="btn-base p-2 rounded-lg"
            style={{ color: surface.muted }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧导航 */}
          <div
            className="w-[140px] shrink-0 border-r p-3 space-y-1"
            style={{ borderColor: surface.divider }}
          >
            <NavButton
              active={activeTab === 'system'}
              onClick={() => setActiveTab('system')}
              label="系统设置"
              surface={surface}
            />
            <NavButton
              active={activeTab === 'sync'}
              onClick={() => setActiveTab('sync')}
              label="同步设置"
              surface={surface}
            />
            <NavButton
              active={activeTab === 'export'}
              onClick={() => setActiveTab('export')}
              label="导入导出"
              surface={surface}
            />
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'system' && (
              <SystemSettings
                isDarkMode={isDarkMode}
                setDarkMode={setDarkMode}
                panelHue={panelHue}
                setPanelHue={setPanelHue}
                currentWorkspace={currentWorkspace}
                surface={surface}
              />
            )}
            {activeTab === 'sync' && (
              <SyncSettings surface={surface} />
            )}
            {activeTab === 'export' && (
              <ExportSettings surface={surface} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavButton({ active, onClick, label, surface }: {
  active: boolean
  onClick: () => void
  label: string
  surface: ReturnType<typeof usePanelSurface>
}) {
  return (
    <button
      onClick={onClick}
      className="btn-base w-full px-3 py-2 rounded-lg text-sm text-left"
      style={{
        backgroundColor: active ? surface.surface : 'transparent',
        color: active ? surface.text : surface.muted,
        border: active ? `1px solid ${surface.divider}` : '1px solid transparent',
      }}
    >
      {label}
    </button>
  )
}

function SystemSettings({ isDarkMode, setDarkMode, panelHue, setPanelHue, currentWorkspace, surface }: {
  isDarkMode: boolean
  setDarkMode: (v: boolean) => void
  panelHue: number
  setPanelHue: (v: number) => void
  currentWorkspace: { path?: string; name?: string } | null
  surface: ReturnType<typeof usePanelSurface>
}) {
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

function SyncSettings({ surface }: { surface: ReturnType<typeof usePanelSurface> }) {
  const syncing = useFlomoSyncStore(s => s.syncing)
  const accessToken = useFlomoSyncStore(s => s.accessToken)
  const email = useFlomoSyncStore(s => s.email)
  const lastSyncTime = useFlomoSyncStore(s => s.lastSyncTime)
  const importedCount = useFlomoSyncStore(s => s.importedCount)
  const error = useFlomoSyncStore(s => s.error)
  const login = useFlomoSyncStore(s => s.login)
  const sync = useFlomoSyncStore(s => s.sync)
  const logout = useFlomoSyncStore(s => s.logout)
  const loadState = useFlomoSyncStore(s => s.loadState)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  const [inputEmail, setInputEmail] = useState('')
  const [inputPassword, setInputPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    loadState()
  }, [loadState, currentWorkspace?.path])

  // 当 loadState 完成后，自动填充已保存的邮箱
  useEffect(() => {
    if (email) {
      setInputEmail(email)
    }
  }, [email])

  const handleLogin = async () => {
    setLoginError(null)
    try {
      await login(inputEmail, inputPassword)
      setInputPassword('')
    } catch (e: any) {
      setLoginError(e.message || '登录失败')
    }
  }

  const handleSync = async () => {
    try {
      const count = await sync()
      if (count > 0) {
        alert(`成功导入 ${count} 条 memo`)
      } else if (!error) {
        alert('没有新的 flomo 内容')
      }
    } catch (e: any) {
      alert(`同步失败: ${e.message || '未知错误'}`)
    }
  }

  const isLoggedIn = !!accessToken

  return (
    <>
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4" style={{ color: surface.text }}>
          Flomo 同步
        </h3>

        {!isLoggedIn ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: surface.muted }}>邮箱</label>
              <input
                type="email"
                value={inputEmail}
                onChange={e => setInputEmail(e.target.value)}
                className="w-full p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: surface.surface,
                  color: surface.text,
                  border: `1px solid ${surface.divider}`,
                  outline: 'none',
                }}
                placeholder="输入 flomo 邮箱"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: surface.muted }}>密码</label>
              <input
                type="password"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                className="w-full p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: surface.surface,
                  color: surface.text,
                  border: `1px solid ${surface.divider}`,
                  outline: 'none',
                }}
                placeholder="输入 flomo 密码"
              />
            </div>
            {loginError && (
              <p className="text-xs text-red-500">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={!inputEmail || !inputPassword}
              className="btn-base flex items-center justify-center gap-2 p-3 rounded-lg w-full text-sm"
              style={{
                backgroundColor: surface.text,
                color: surface.panelBg,
                opacity: !inputEmail || !inputPassword ? 0.5 : 1,
              }}
            >
              <Link size={16} />
              连接 Flomo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: surface.surface }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: surface.text }}>
                  已连接
                </span>
                <span className="text-xs" style={{ color: surface.muted }}>
                  {email}
                </span>
              </div>
              <button
                onClick={logout}
                className="btn-base flex items-center gap-1 p-1.5 rounded-md text-xs"
                style={{ color: surface.muted }}
              >
                <LogOut size={14} />
                断开
              </button>
            </div>

            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: surface.surface }}
            >
              <div className="text-xs mb-2" style={{ color: surface.muted }}>
                同步状态
              </div>
              <div className="text-sm" style={{ color: surface.text }}>
                已导入 {importedCount} 条 memo
              </div>
              {lastSyncTime && (
                <div className="text-xs mt-1" style={{ color: surface.muted }}>
                  上次同步：{new Date(lastSyncTime).toLocaleString('zh-CN')}
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-base flex items-center justify-center gap-2 p-3 rounded-lg w-full text-sm"
              style={{
                backgroundColor: surface.text,
                color: surface.panelBg,
                opacity: syncing ? 0.5 : 1,
              }}
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? '同步中...' : '同步 Flomo'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function ExportSettings({ surface }: { surface: ReturnType<typeof usePanelSurface> }) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-4" style={{ color: surface.text }}>
        导入导出
      </h3>
      <div className="flex gap-3">
        <button
          className="btn-base flex-1 flex items-center justify-center gap-2 p-4 rounded-lg"
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
          className="btn-base flex-1 flex items-center justify-center gap-2 p-4 rounded-lg"
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
  )
}