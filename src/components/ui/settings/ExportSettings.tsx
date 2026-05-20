import { usePanelSurface } from '../../../hooks/usePanelSurface'
import { Download, Upload } from 'lucide-react'

export function ExportSettings() {
  const surface = usePanelSurface()

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