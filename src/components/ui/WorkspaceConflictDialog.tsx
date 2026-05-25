import { usePanelSurface } from '../../hooks/usePanelSurface'
import { AlertTriangle, Database } from 'lucide-react'

export interface ConflictData {
  expectedCards: number
  actualCards: number
  expectedBoards: number
  actualBoards: number
}

interface WorkspaceConflictDialogProps {
  conflict: ConflictData
  hasBackup: boolean
  onChoice: (choice: 'backup' | 'continue' | 'cancel') => void
}

export function WorkspaceConflictDialog({ conflict, hasBackup, onChoice }: WorkspaceConflictDialogProps) {
  const surface = usePanelSurface()

  const cardMismatch = conflict.expectedCards !== conflict.actualCards
  const boardMismatch = conflict.expectedBoards !== conflict.actualBoards

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
    >
      <div
        className="w-[480px] rounded-xl flex flex-col animate-scaleIn overflow-hidden glass-panel"
        style={{
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{ borderColor: surface.divider, backgroundColor: 'hsla(var(--panel-hue, 220), 60%, 50%, 0.08)' }}
        >
          <AlertTriangle size={24} style={{ color: 'var(--text-danger)' }} />
          <div>
            <h3 className="font-semibold text-base" style={{ color: surface.text }}>
              工作区数据不一致
            </h3>
            <p className="text-sm" style={{ color: surface.muted }}>
              检测到数据可能丢失或损坏
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm" style={{ color: surface.text }}>
            磁盘上的实际数据与元数据记录不匹配：
          </p>

          <div className="space-y-3">
            {cardMismatch && (
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: surface.surface }}
              >
                <span className="text-sm" style={{ color: surface.text }}>
                  卡片数量
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-danger)' }}>
                    磁盘有 {conflict.actualCards} 张卡片
                  </span>
                  <span className="text-sm" style={{ color: surface.muted }}>·</span>
                  <span className="text-sm font-medium" style={{ color: surface.muted }}>
                    元数据记录 {conflict.expectedCards} 张
                  </span>
                </div>
              </div>
            )}

            {boardMismatch && (
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: surface.surface }}
              >
                <span className="text-sm" style={{ color: surface.text }}>
                  画板数量
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-danger)' }}>
                    磁盘有 {conflict.actualBoards} 个画板
                  </span>
                  <span className="text-sm" style={{ color: surface.muted }}>·</span>
                  <span className="text-sm font-medium" style={{ color: surface.muted }}>
                    元数据记录 {conflict.expectedBoards} 个
                  </span>
                </div>
              </div>
            )}
          </div>

          <div
            className="p-3 rounded-lg text-sm"
            style={{ backgroundColor: 'hsla(var(--panel-hue, 220), 80%, 50%, 0.08)', color: 'var(--color-blue-400)' }}
          >
            可能原因：数据文件被意外删除、同步失败、或程序异常退出导致数据未完整保存。
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: surface.divider }}
        >
          <button
            onClick={() => onChoice('cancel')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: surface.muted,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = surface.surface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            取消加载
          </button>

          <button
            onClick={() => onChoice('continue')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: 'var(--text-inverse)',
              backgroundColor: 'var(--color-blue-500)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-blue-600)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-blue-500)'
            }}
          >
            保留磁盘数据
          </button>

          {hasBackup && (
            <button
              onClick={() => onChoice('backup')}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              style={{
                color: surface.text,
                backgroundColor: surface.surface,
                border: `1px solid ${surface.divider}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = surface.divider
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = surface.surface
              }}
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
