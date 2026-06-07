import { Download, Upload } from 'lucide-react'

export function ExportSettings() {
  return (
    <div>
      <h3 className="text-sm font-medium mb-4 text-text-primary">
        导入导出
      </h3>
      <div className="flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg bg-surface-panel-hover text-text-primary hover:bg-surface-card-active transition-colors">
          <Download size={18} />
          <span>导出数据</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 p-4 rounded-lg bg-surface-panel-hover text-text-primary hover:bg-surface-card-active transition-colors">
          <Upload size={18} />
          <span>导入数据</span>
        </button>
      </div>
    </div>
  )
}
