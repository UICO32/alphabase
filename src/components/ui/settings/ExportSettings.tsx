import { Download, Upload } from 'lucide-react'
import { Button } from '../shadcn/button'
import { SettingGroup } from './SettingPrimitives'

export function ExportSettings() {
  return (
    <SettingGroup title="导入导出">
      <div className="py-2.5 flex gap-2">
        <Button variant="secondary" className="flex-1">
          <Download size={18} /> 导出数据
        </Button>
        <Button variant="secondary" className="flex-1">
          <Upload size={18} /> 导入数据
        </Button>
      </div>
    </SettingGroup>
  )
}
