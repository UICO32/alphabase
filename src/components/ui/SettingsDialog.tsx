import { useState } from 'react'
import { X } from 'lucide-react'
import { SystemSettings } from './settings/SystemSettings'
import { SyncSettings } from './settings/SyncSettings'
import { ExportSettings } from './settings/ExportSettings'
import { AISettings } from './settings/AISettings'

type SettingsTab = 'system' | 'sync' | 'export' | 'ai'

interface SettingsDialogProps {
  onClose: () => void
  initialTab?: SettingsTab
}

export function SettingsDialog({ onClose, initialTab = 'system' }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
      onClick={onClose}
    >
      <div
        className="w-[700px] h-[80vh] rounded-xl flex flex-col animate-scaleIn overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-card)',
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-base font-semibold text-text-primary">
            设置
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-panel-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className="w-[140px] shrink-0 p-3 space-y-1"
            style={{ backgroundColor: 'var(--surface-panel)', borderRight: '1px solid var(--border-default)' }}
          >
            <NavButton
              active={activeTab === 'system'}
              onClick={() => setActiveTab('system')}
              label="系统设置"
            />
            <NavButton
              active={activeTab === 'sync'}
              onClick={() => setActiveTab('sync')}
              label="同步设置"
            />
            <NavButton
              active={activeTab === 'export'}
              onClick={() => setActiveTab('export')}
              label="导入导出"
            />
            <NavButton
              active={activeTab === 'ai'}
              onClick={() => setActiveTab('ai')}
              label="AI 设置"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide" style={{ backgroundColor: 'var(--surface-card)' }}>
            {activeTab === 'system' && <SystemSettings />}
            {activeTab === 'sync' && <SyncSettings />}
            {activeTab === 'export' && <ExportSettings />}
            {activeTab === 'ai' && <AISettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavButton({ active, onClick, label }: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
        active
          ? 'bg-surface-card-active text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-panel-hover'
      }`}
    >
      {label}
    </button>
  )
}
