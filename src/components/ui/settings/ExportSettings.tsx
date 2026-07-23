import { useCallback, useEffect, useState } from 'react'
import { Download, ExternalLink, RefreshCw, RotateCcw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../shadcn/button'
import { SettingGroup } from './SettingPrimitives'
import { getBackupCapabilities, type ElectronAPI } from '../../../platform/electronCapabilities'
import { flushActiveSyncEngine, stopActiveSyncEngine } from '../../../sync/syncEngineRef'
import { cleanupSubscriptions } from '../../../sync/subscriptionManager'
import { useCardStore } from '../../../stores/cardStore'
import { useBoardStore } from '../../../stores/boardStore'
import { useTrashStore } from '../../../stores/trashStore'
import { emit, on } from '../../../stores/eventBus'

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'
type BackupAPI = ElectronAPI['backup']

function describeStage(result: BackupOperationResult): string {
  const labels: Record<NonNullable<BackupOperationResult['stage']>, string> = {
    selection: '选择目录',
    validation: '校验备份',
    'safety-backup': '创建安全备份',
    staging: '准备恢复数据',
    replacement: '替换工作区',
    reload: '重新加载工作区',
    export: '导出备份',
  }
  const prefix = result.stage ? `${labels[result.stage]}失败` : '操作失败'
  const destination = result.stage === 'export' && result.path ? `（目标：${result.path}）` : ''
  return `${prefix}${destination}：${result.error || '未知错误'}`
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function summaryText(summary: BackupSummary): string {
  return `${summary.cardCount} 张卡片 · ${summary.boardCount} 个画板 · ${summary.trashCount} 项回收站 · ${summary.mediaCount} 个媒体文件`
}

async function reloadWorkspaceAfterRestore(): Promise<void> {
  useCardStore.setState({ cards: {}, isLoaded: false })
  useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
  useTrashStore.setState({ items: [] })

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe()
      reject(new Error('工作区重新加载超时'))
    }, 20_000)
    const unsubscribe = on('data-ready', () => {
      window.clearTimeout(timeout)
      unsubscribe()
      resolve()
    })
    emit('reinit-workspace', undefined)
  })
}

export function ExportSettings() {
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [recentBackups, setRecentBackups] = useState<BackupSummary[]>([])
  const [pendingImport, setPendingImport] = useState<BackupSummary | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)

  const workspacePath = localStorage.getItem(LAST_WORKSPACE_KEY)

  const loadRecentBackups = useCallback(async () => {
    if (!workspacePath) {
      setRecentBackups([])
      return
    }
    const capabilities = getBackupCapabilities()
    if (!capabilities.ok) {
      setRecentBackups([])
      return
    }
    try {
      setRecentBackups(await capabilities.value.listRecent(workspacePath))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取最近备份失败')
    }
  }, [workspacePath])

  useEffect(() => {
    void loadRecentBackups()
  }, [loadRecentBackups])

  const run = async (action: string, operation: () => Promise<void>) => {
    if (busyAction) return
    setBusyAction(action)
    try {
      await operation()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setBusyAction(null)
    }
  }

  const prepareWorkspaceForRestore = async () => {
    await flushActiveSyncEngine()
    await stopActiveSyncEngine()
    cleanupSubscriptions()
  }

  const requireBackupAPI = () => {
    const capabilities = getBackupCapabilities()
    if (!capabilities.ok) {
      toast.error(capabilities.reason === 'ipc-error' ? '备份服务连接失败' : '备份功能仅在桌面应用中可用')
      return null
    }
    return capabilities.value
  }

  const withBackupAPI = (operation: (backup: BackupAPI) => Promise<void>) => {
    const backup = requireBackupAPI()
    return backup ? operation(backup) : Promise.resolve()
  }

  const handleExportCurrent = () => run('export-current', async () => {
    if (!workspacePath) {
      toast.error('请先打开一个工作区')
      return
    }
    await withBackupAPI(async backup => {
      await flushActiveSyncEngine()
      const result = await backup.exportCurrent(workspacePath)
      if (!result.success || !result.path) {
        toast.error(describeStage(result))
        return
      }
      setLastExportPath(result.path)
      toast.success(`完整备份已导出到 ${result.path}`)
    })
  })

  const handleSelectImport = () => run('select-import', () => withBackupAPI(async backup => {
    const result = await backup.selectExternal()
    if (!result) return
    if (!result.success || !result.summary) {
      toast.error(describeStage(result))
      return
    }
    setPendingImport(result.summary)
  }))

  const finishRestore = async (result: BackupOperationResult) => {
    let reloadError: unknown
    try {
      await reloadWorkspaceAfterRestore()
    } catch (error) {
      reloadError = error
    }

    if (!result.success) {
      const recovery = result.safetyBackupPath ? `；安全备份：${result.safetyBackupPath}` : ''
      const reload = reloadError
        ? `；重新加载失败：${reloadError instanceof Error ? reloadError.message : String(reloadError)}`
        : ''
      toast.error(`${describeStage(result)}${recovery}${reload}`)
      return
    }

    if (reloadError) {
      const recovery = result.safetyBackupPath ? `；安全备份：${result.safetyBackupPath}` : ''
      toast.error(`重新加载工作区失败：${reloadError instanceof Error ? reloadError.message : String(reloadError)}${recovery}`)
      return
    }

    setPendingImport(null)
    await loadRecentBackups()
    toast.success('备份已恢复，工作区重新加载完成')
  }

  const restoreAndReload = async (operation: () => Promise<BackupOperationResult>) => {
    await prepareWorkspaceForRestore()
    try {
      await finishRestore(await operation())
    } catch (error) {
      // IPC can reject before a structured result is returned. Restart the
      // workspace so stopping the sync engine never leaves the app inert.
      await reloadWorkspaceAfterRestore().catch(() => undefined)
      throw error
    }
  }

  const handleConfirmImport = () => run('restore-external', async () => {
    if (!workspacePath || !pendingImport) return
    await withBackupAPI(backup => restoreAndReload(() => backup.restoreExternal(workspacePath, pendingImport.path)))
  })

  const handleRestoreRecent = (summary: BackupSummary) => run(`restore-${summary.timestamp}`, async () => {
    if (!workspacePath) return
    const warning = summary.format === 'legacy'
      ? '\n\n这是旧版备份，缺失的媒体或元数据无法恢复。'
      : ''
    if (!window.confirm(`确定用 ${formatDate(summary.createdAt)} 的备份替换当前工作区吗？\n${summaryText(summary)}${warning}`)) return
    await withBackupAPI(backup => restoreAndReload(() => backup.restoreRecent(workspacePath, summary.timestamp)))
  })

  const handleExportRecent = (summary: BackupSummary) => run(`export-${summary.timestamp}`, async () => {
    if (!workspacePath) return
    await withBackupAPI(async backup => {
      const result = await backup.exportRecent(workspacePath, summary.timestamp)
      if (!result.success || !result.path) {
        toast.error(describeStage(result))
        return
      }
      setLastExportPath(result.path)
      toast.success(`备份已导出到 ${result.path}`)
    })
  })

  const handleOpenExport = () => run('open-export', async () => {
    if (!lastExportPath) return
    await withBackupAPI(async backup => {
      try {
        await backup.openExportDirectory(lastExportPath)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '无法打开导出目录')
      }
    })
  })

  return (
    <>
      <SettingGroup title="导入与导出">
        <div className="space-y-3 py-2.5">
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => void handleExportCurrent()} disabled={!!busyAction}>
              <Download size={18} /> {busyAction === 'export-current' ? '正在导出…' : '导出完整备份'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void handleSelectImport()} disabled={!!busyAction}>
              <Upload size={18} /> {busyAction === 'select-import' ? '正在校验…' : '选择备份文件夹'}
            </Button>
          </div>
          <p className="text-xs text-fg-tertiary">
            导出会在“下载/Abase Backups”中创建完整备份。导入会先创建当前工作区的安全备份，再替换卡片、画板、回收站、媒体和元数据。
          </p>
          {lastExportPath && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-line-default bg-surface-card px-3 py-2 text-xs">
              <span className="min-w-0 truncate text-fg-secondary" title={lastExportPath}>{lastExportPath}</span>
              <Button variant="ghost" size="sm" onClick={() => void handleOpenExport()} disabled={!!busyAction}>
                <ExternalLink size={14} /> 打开目录
              </Button>
            </div>
          )}
          {pendingImport && (
            <div className="space-y-2 rounded-md border border-line-default bg-surface-card p-3">
              <div className="text-sm font-medium text-fg-primary">确认替换当前工作区</div>
              <div className="text-xs text-fg-secondary">创建时间：{formatDate(pendingImport.createdAt)}</div>
              <div className="text-xs text-fg-secondary">{summaryText(pendingImport)}</div>
              <div className="text-xs text-fg-secondary">
                格式：{pendingImport.format === 'current' ? '当前格式' : '旧版格式'}
              </div>
              {pendingImport.warnings.map(warning => (
                <div key={warning} className="text-xs text-warning">{warning}</div>
              ))}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setPendingImport(null)} disabled={!!busyAction}>取消</Button>
                <Button size="sm" onClick={() => void handleConfirmImport()} disabled={!!busyAction}>
                  {busyAction === 'restore-external' ? '正在恢复…' : '创建安全备份并恢复'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SettingGroup>

      <SettingGroup title="最近的自动备份">
        <div className="flex justify-end py-2">
          <Button variant="ghost" size="sm" onClick={() => void loadRecentBackups()} disabled={!!busyAction || !workspacePath}>
            <RefreshCw size={14} /> 刷新列表
          </Button>
        </div>
        {!workspacePath && <div className="py-3 text-xs text-fg-tertiary">请先打开一个工作区。</div>}
        {workspacePath && recentBackups.length === 0 && (
          <div className="py-3 text-xs text-fg-tertiary">暂无可用的自动备份。</div>
        )}
        {recentBackups.map(summary => (
          <div key={summary.timestamp} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="text-sm text-fg-primary">{formatDate(summary.createdAt)}</div>
              <div className="mt-0.5 text-xs text-fg-tertiary">{summaryText(summary)}</div>
              <div className="mt-0.5 text-xs text-fg-tertiary">
                {summary.format === 'current' ? '当前格式' : '旧版格式 · 媒体和元数据可能不完整'}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" onClick={() => void handleExportRecent(summary)} disabled={!!busyAction}>
                <Download size={14} /> 导出
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleRestoreRecent(summary)} disabled={!!busyAction}>
                <RotateCcw size={14} /> 恢复
              </Button>
            </div>
          </div>
        ))}
      </SettingGroup>
    </>
  )
}
