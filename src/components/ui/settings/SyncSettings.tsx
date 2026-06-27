import { useState, useEffect } from 'react'
import { useFlomoSyncStore } from '../../../sync/flomoSync'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { RefreshCw, LogOut, Link } from 'lucide-react'
import { Button } from '../shadcn/button'
import { Input } from '../shadcn/input'
import { SettingGroup, SettingRow, FieldLabel } from './SettingPrimitives'

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

  useEffect(() => { loadState() }, [loadState, currentWorkspace?.path])
  useEffect(() => { if (email) setInputEmail(email) }, [email])

  const handleLogin = async () => {
    setLoginError(null)
    try {
      await login(inputEmail, inputPassword)
      setInputPassword('')
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : '登录失败')
    }
  }

  const handleSync = async () => {
    try {
      const count = await sync()
      if (count > 0) alert(`成功导入 ${count} 条 memo`)
      else if (!error) alert('没有新的 flomo 内容')
    } catch (e: unknown) {
      alert(`同步失败: ${e instanceof Error ? e.message : '未知错误'}`)
    }
  }

  const isLoggedIn = !!accessToken

  return (
    <SettingGroup title="Flomo 同步">
      {!isLoggedIn ? (
        <>
          <div className="py-2.5">
            <FieldLabel>邮箱</FieldLabel>
            <Input
              type="email"
              value={inputEmail}
              onChange={e => setInputEmail(e.target.value)}
              placeholder="输入 flomo 邮箱"
            />
          </div>
          <div className="py-2.5">
            <FieldLabel>密码</FieldLabel>
            <Input
              type="password"
              value={inputPassword}
              onChange={e => setInputPassword(e.target.value)}
              placeholder="输入 flomo 密码"
            />
          </div>
          {loginError && <p className="text-xs text-fg-danger py-2.5">{loginError}</p>}
          <div className="py-2.5">
            <Button onClick={handleLogin} disabled={!inputEmail || !inputPassword} className="w-full">
              <Link size={16} /> 连接 Flomo
            </Button>
          </div>
        </>
      ) : (
        <>
          <SettingRow label="已连接" description={email ?? undefined}>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut size={14} /> 断开
            </Button>
          </SettingRow>
          <SettingRow label={`已导入 ${importedCount} 条 memo`} description={lastSyncTime ? `上次同步：${new Date(lastSyncTime).toLocaleString('zh-CN')}` : undefined}>
            <span />
          </SettingRow>
          {error && <p className="text-xs text-fg-danger py-2.5">{error}</p>}
          <div className="py-2.5">
            <Button onClick={handleSync} disabled={syncing} className="w-full">
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? '同步中...' : '同步 Flomo'}
            </Button>
          </div>
        </>
      )}
    </SettingGroup>
  )
}
