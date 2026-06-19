import { AlertTriangle, Database, Merge } from 'lucide-react'
import type { ConflictDiffItem } from '../../utils/workspace/types'

export interface ConflictData {
  expectedCards: number
  actualCards: number
  expectedBoards: number
  actualBoards: number
  diffItems: ConflictDiffItem[]
}

interface WorkspaceConflictDialogProps {
  conflict: ConflictData
  hasBackup: boolean
  onChoice: (choice: 'backup' | 'continue' | 'merge' | 'cancel') => void
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}个月前`
  return `${Math.floor(months / 12)}年前`
}

export function WorkspaceConflictDialog({ conflict, hasBackup, onChoice }: WorkspaceConflictDialogProps) {
  const cardMismatch = conflict.expectedCards !== conflict.actualCards
  const boardMismatch = conflict.expectedBoards !== conflict.actualBoards
  const extraItems = conflict.diffItems.filter(i => i.diffType === 'extra')
  const missingItems = conflict.diffItems.filter(i => i.diffType === 'missing')

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
    >
      <div
        className="w-[520px] rounded-xl flex flex-col animate-scaleIn overflow-hidden glass-panel"
        style={{
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-line-default"
          style={{ backgroundColor: 'hsla(220, 60%, 50%, 0.08)' }}
        >
          <AlertTriangle size={24} style={{ color: 'var(--fg-danger)' }} />
          <div>
            <h3 className="font-semibold text-base text-fg-primary">
              工作区数据不一致
            </h3>
            <p className="text-sm text-fg-secondary">
              检测到数据可能丢失或损坏
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4 max-h-[400px] overflow-y-auto">
          <p className="text-sm text-fg-primary">
            磁盘上的实际数据与元数据记录不匹配：
          </p>

          <div className="space-y-3">
            {cardMismatch && (
              <div
                className="flex items-center justify-between p-3 rounded-lg bg-surface-card"
              >
                <span className="text-sm text-fg-primary">
                  卡片数量
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--fg-danger)' }}>
                    磁盘有 {conflict.actualCards} 张卡片
                  </span>
                  <span className="text-sm text-fg-secondary">·</span>
                  <span className="text-sm font-medium text-fg-secondary">
                    元数据记录 {conflict.expectedCards} 张
                  </span>
                </div>
              </div>
            )}

            {boardMismatch && (
              <div
                className="flex items-center justify-between p-3 rounded-lg bg-surface-card"
              >
                <span className="text-sm text-fg-primary">
                  画板数量
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--fg-danger)' }}>
                    磁盘有 {conflict.actualBoards} 个画板
                  </span>
                  <span className="text-sm text-fg-secondary">·</span>
                  <span className="text-sm font-medium text-fg-secondary">
                    元数据记录 {conflict.expectedBoards} 个
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Diff items */}
          {conflict.diffItems.length > 0 && (
            <div className="space-y-2">
              {extraItems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-fg-secondary mb-1.5">
                    磁盘多出（{extraItems.length}）
                  </p>
                  <div className="space-y-1">
                    {extraItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-surface-card text-xs">
                        <span className="text-fg-primary truncate max-w-[280px]">
                          {item.type === 'board' ? '📋 ' : ''}{item.title || item.id}
                        </span>
                        {item.updatedAt && (
                          <span className="text-fg-secondary shrink-0 ml-2">{formatRelativeTime(item.updatedAt)}</span>
                        )}
                      </div>
                    ))}
                    {extraItems.length > 5 && (
                      <p className="text-xs text-fg-secondary px-2.5">...还有 {extraItems.length - 5} 项</p>
                    )}
                  </div>
                </div>
              )}

              {missingItems.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--fg-danger)' }}>
                    磁盘缺失（{missingItems.length}）
                  </p>
                  <div className="space-y-1">
                    {missingItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-surface-card text-xs">
                        <span className="text-fg-primary truncate max-w-[280px]">
                          {item.type === 'board' ? '📋 ' : ''}{item.title || item.id}
                        </span>
                        {item.updatedAt && (
                          <span className="text-fg-secondary shrink-0 ml-2">{formatRelativeTime(item.updatedAt)}</span>
                        )}
                      </div>
                    ))}
                    {missingItems.length > 5 && (
                      <p className="text-xs text-fg-secondary px-2.5">...还有 {missingItems.length - 5} 项</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            className="p-3 rounded-lg text-sm"
            style={{ backgroundColor: 'hsla(220, 80%, 50%, 0.08)', color: 'var(--color-blue-400)' }}
          >
            可能原因：数据文件被意外删除、同步失败、或程序异常退出导致数据未完整保存。
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line-default"
        >
          <button
            onClick={() => onChoice('cancel')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-fg-secondary hover:bg-surface-card"
          >
            取消加载
          </button>

          <button
            onClick={() => onChoice('merge')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-fg-primary bg-surface-card border border-line-default hover:bg-border-default"
          >
            <Merge size={14} />
            自动合并
          </button>

          <button
            onClick={() => onChoice('continue')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-[var(--fg-inverse)] bg-[var(--color-blue-500)] hover:bg-[var(--color-blue-600)]"
          >
            保留磁盘数据
          </button>

          {hasBackup && (
            <button
              onClick={() => onChoice('backup')}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-fg-primary bg-surface-card border border-line-default hover:bg-border-default"
            >
              <Database size={14} />
              使用备份恢复
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
