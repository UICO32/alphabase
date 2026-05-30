import { useState, useEffect } from 'react'
import { useFlomoSyncStore } from '../../../sync/flomoSync'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { RefreshCw, LogOut, Link } from 'lucide-react'

export function SyncSettings() {
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '登录失败';
      setLoginError(message);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      alert(`同步失败: ${message}`)
    }
  }

  const isLoggedIn = !!accessToken

  return (
    <>
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-text-primary">
          Flomo 同步
        </h3>

        {!isLoggedIn ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs mb-1 block text-text-secondary">邮箱</label>
              <input
                type="email"
                value={inputEmail}
                onChange={e => setInputEmail(e.target.value)}
                className="w-full p-3 rounded-lg text-sm bg-surface-card text-text-primary border border-border-default outline-none"
                placeholder="输入 flomo 邮箱"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block text-text-secondary">密码</label>
              <input
                type="password"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                className="w-full p-3 rounded-lg text-sm bg-surface-card text-text-primary border border-border-default outline-none"
                placeholder="输入 flomo 密码"
              />
            </div>
            {loginError && (
              <p className="text-xs text-text-danger">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={!inputEmail || !inputPassword}
              className="btn-base flex items-center justify-center gap-2 p-3 rounded-lg w-full text-sm bg-text-primary text-surface-app"
              style={{ opacity: !inputEmail || !inputPassword ? 0.5 : 1 }}
            >
              <Link size={16} />
              连接 Flomo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-card">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-primary">
                  已连接
                </span>
                <span className="text-xs text-text-secondary">
                  {email}
                </span>
              </div>
              <button
                onClick={logout}
                className="btn-base flex items-center gap-1 p-1.5 rounded-md text-xs text-text-secondary"
              >
                <LogOut size={14} />
                断开
              </button>
            </div>

            <div className="p-3 rounded-lg bg-surface-card">
              <div className="text-xs mb-2 text-text-secondary">
                同步状态
              </div>
              <div className="text-sm text-text-primary">
                已导入 {importedCount} 条 memo
              </div>
              {lastSyncTime && (
                <div className="text-xs mt-1 text-text-secondary">
                  上次同步：{new Date(lastSyncTime).toLocaleString('zh-CN')}
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-text-danger">{error}</p>
            )}

            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-base flex items-center justify-center gap-2 p-3 rounded-lg w-full text-sm bg-text-primary text-surface-app"
              style={{ opacity: syncing ? 0.5 : 1 }}
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