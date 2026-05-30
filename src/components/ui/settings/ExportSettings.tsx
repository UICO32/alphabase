import { Download, Upload } from 'lucide-react'

export function ExportSettings() {
  return (
    <div>
      <h3 className="text-sm font-medium mb-4 text-text-primary">
        导入导出
      </h3>
      <div className="flex gap-3">
        <button
          className="btn-base flex-1 flex items-center justify-center gap-2 p-4 rounded-lg bg-surface-card text-text-primary border border-border-default"
        >
          <Download size={18} />
          <span>导出数据</span>
        </button>
        <button
          className="btn-base flex-1 flex items-center justify-center gap-2 p-4 rounded-lg bg-surface-card text-text-primary border border-border-default"
        >
          <Upload size={18} />
          <span>导入数据</span>
        </button>
      </div>
    </div>
  )
}
