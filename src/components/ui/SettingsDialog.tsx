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
import { DesignSystemPanel } from './settings/DesignSystemPanel'

type SettingsTab = 'system' | 'sync' | 'export' | 'ai' | 'design'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export function SettingsDialog({ open, onClose, initialTab = 'system' }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="flex flex-col gap-0 w-[700px] max-w-none h-[80vh] p-0 overflow-hidden"
        onInteractOutside={(event) => {
          if (document.querySelector('[data-radix-select-content]')) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader className="px-6 py-4 border-b border-line-default">
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SettingsTab)}
          className="flex min-h-0 flex-1"
        >
          <TabsList className="flex h-full w-[140px] shrink-0 flex-col items-stretch justify-start gap-1 rounded-none border-r border-line-default bg-surface-panel-alt p-3 text-fg-secondary">
            {([['system','系统设置'],['sync','同步设置'],['export','导入导出'],['ai','AI 设置'],['design','设计系统']] as const).map(([val, label]) => (
              <TabsTrigger
                key={val}
                value={val}
                className="h-8 w-full cursor-pointer justify-start px-3 text-sm data-[state=active]:bg-surface-card data-[state=active]:text-fg-primary"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
            <TabsContent value="design" className="flex-1 overflow-y-auto p-6 scrollbar-hide mt-0">
              <DesignSystemPanel />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
