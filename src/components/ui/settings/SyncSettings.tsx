import { useState, useEffect } from 'react'
import { useFlomoSyncStore } from '../../../sync/flomoSync'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { usePanelSurface } from '../../../hooks/usePanelSurface'
import { RefreshCw, LogOut, Link } from 'lucide-react'

export function SyncSettings() {
  const surface = usePanelSurface()
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