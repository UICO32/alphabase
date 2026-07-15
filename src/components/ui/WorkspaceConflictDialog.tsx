import { AlertTriangle, Database, HardDrive } from 'lucide-react'
import type { ConflictDiffItem } from '../../utils/workspace/types'

export interface BackupSummary {
  timestamp: string
  createdAt: number
  cardCount: number
  boardCount: number
}

export interface ConflictData {
  expectedCards: number
  actualCards: number
  expectedBoards: number
  actualBoards: number
  diffItems: ConflictDiffItem[]
  latestBackup?: BackupSummary | null
}

interface WorkspaceConflictDialogProps {
  conflict: ConflictData
  hasBackup: boolean
  latestBackup?: BackupSummary | null
  onChoice: (choice: 'backup' | 'continue' | 'cancel') => void
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '未知时间'
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function WorkspaceConflictDialog({ conflict, hasBackup, latestBackup, onChoice }: WorkspaceConflictDialogProps) {
  const missingCards = Math.max(conflict.expectedCards - conflict.actualCards, 0)
  const missingBoards = Math.max(conflict.expectedBoards - conflict.actualBoards, 0)
  const backup = latestBackup ?? conflict.latestBackup ?? null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
    >
      <div
        className="w-[560px] rounded-xl flex flex-col animate-scaleIn overflow-hidden glass-panel"
        style={{ boxShadow: 'var(--shadow-xl)' }}
      >
        <div
          className="flex items-start gap-3 px-6 py-4 border-b border-line-default"
          style={{ backgroundColor: 'hsla(0, 75%, 50%, 0.08)' }}
        >
          <AlertTriangle size={24} className="mt-0.5 shrink-0" style={{ color: 'var(--fg-danger)' }} />
          <div>
            <h3 className="font-semibold text-base text-fg-primary">检测到工作区数据不完整</h3>
            <p className="text-sm text-fg-secondary mt-1">
              元数据记录的数量和磁盘上的文件数量不一致。为了避免误删数据，请先选择如何处理。
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-card p-3">
              <div className="text-xs text-fg-secondary">元数据记录</div>
              <div className="text-sm text-fg-primary mt-1">
                {conflict.expectedCards} 张卡片 · {conflict.expectedBoards} 个画板
              </div>
            </div>
            <div className="rounded-lg bg-surface-card p-3">
              <div className="text-xs text-fg-secondary">当前磁盘文件</div>
              <div className="text-sm mt-1" style={{ color: missingCards || missingBoards ? 'var(--fg-danger)' : 'var(--fg-primary)' }}>
                {conflict.actualCards} 张卡片 · {conflict.actualBoards} 个画板
              </div>
            </div>
          </div>

          {(missingCards > 0 || missingBoards > 0) && (
            <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'hsla(0, 75%, 50%, 0.08)', color: 'var(--fg-danger)' }}>
              当前磁盘比记录少了 {missingCards} 张卡片、{missingBoards} 个画板。这个状态看起来像数据目录被清空或重建过。
            </div>
          )}

          <div className="space-y-3">
            {hasBackup && backup && (
              <button
                onClick={() => onChoice('backup')}
                className="w-full rounded-lg border border-line-focus bg-surface-card px-4 py-3 text-left transition-colors hover:bg-surface-card-active"
              >
                <div className="flex items-start gap-3">
                  <Database size={18} className="mt-0.5 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-fg-primary">恢复最近备份（推荐）</div>
                    <div className="text-xs text-fg-secondary mt-1 leading-5">
                      恢复 {backup.cardCount} 张卡片、{backup.boardCount} 个画板。恢复前会先保存当前磁盘状态，所以这一步可回退。
                    </div>
                    <div className="text-xs text-fg-tertiary mt-1">备份时间：{formatDate(backup.createdAt)}</div>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={() => onChoice('continue')}
              className="w-full rounded-lg border border-line-default bg-transparent px-4 py-3 text-left transition-colors hover:bg-surface-card"
            >
              <div className="flex items-start gap-3">
                <HardDrive size={18} className="mt-0.5 shrink-0 text-fg-secondary" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-fg-primary">继续使用当前磁盘数据</div>
                  <div className="text-xs text-fg-secondary mt-1 leading-5">
                    保留当前的 {conflict.actualCards} 张卡片、{conflict.actualBoards} 个画板。不恢复缺失文件，后续自动备份可能会保存这个状态。
                  </div>
                </div>
              </div>
            </button>
          </div>

          {!hasBackup && (
            <div className="rounded-lg bg-surface-card p-3 text-sm text-fg-secondary">
              没有找到可用备份。建议先不要继续操作，检查工作区目录是否被移动、清空或同步软件覆盖。
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-line-default">
          <button
            onClick={() => onChoice('cancel')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-fg-secondary hover:bg-surface-card"
          >
            先不加载
          </button>
        </div>
      </div>
    </div>
  )
}
