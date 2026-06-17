import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/shadcn/tabs'
import { SystemSettings } from './settings/SystemSettings'
import { SyncSettings } from './settings/SyncSettings'
import { ExportSettings } from './settings/ExportSettings'
import { AISettings } from './settings/AISettings'

type SettingsTab = 'system' | 'sync' | 'export' | 'ai'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export function SettingsDialog({ open, onClose, initialTab = 'system' }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[700px] max-w-none h-[80vh] p-0 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SettingsTab)}
          className="flex h-full"
        >
          <TabsList className="flex-col h-full w-[140px] shrink-0 rounded-none border-r bg-muted/50 p-3 gap-1">
            <TabsTrigger value="system" className="w-full justify-start rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              系统设置
            </TabsTrigger>
            <TabsTrigger value="sync" className="w-full justify-start rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              同步设置
            </TabsTrigger>
            <TabsTrigger value="export" className="w-full justify-start rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              导入导出
            </TabsTrigger>
            <TabsTrigger value="ai" className="w-full justify-start rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              AI 设置
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 flex flex-col overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle>设置</DialogTitle>
            </DialogHeader>
            <TabsContent value="system" className="flex-1 overflow-y-auto p-6 scrollbar-hide mt-0">
              <SystemSettings />
            </TabsContent>
            <TabsContent value="sync" className="flex-1 overflow-y-auto p-6 scrollbar-hide mt-0">
              <SyncSettings />
            </TabsContent>
            <TabsContent value="export" className="flex-1 overflow-y-auto p-6 scrollbar-hide mt-0">
              <ExportSettings />
            </TabsContent>
            <TabsContent value="ai" className="flex-1 overflow-y-auto p-6 scrollbar-hide mt-0">
              <AISettings />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
