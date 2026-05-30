import { useState } from 'react'
import { X } from 'lucide-react'
import { SystemSettings } from './settings/SystemSettings'
import { SyncSettings } from './settings/SyncSettings'
import { ExportSettings } from './settings/ExportSettings'

type SettingsTab = 'system' | 'sync' | 'export'

interface SettingsDialogProps {
  onClose: () => void
  initialTab?: SettingsTab
}

export function SettingsDialog({ onClose, initialTab = 'system' }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
      onClick={onClose}
    >
      <div
        className="modal-content w-[700px] h-[80vh] rounded-xl flex flex-col animate-scaleIn glass-panel"
        style={{
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-border-default transition-theme"
        >
          <span className="font-semibold text-text-primary">
            设置
          </span>
          <button
            onClick={onClose}
            className="btn-base p-2 rounded-lg text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className="w-[140px] shrink-0 border-r border-border-default p-3 space-y-1"
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
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            {activeTab === 'system' && <SystemSettings />}
            {activeTab === 'sync' && <SyncSettings />}
            {activeTab === 'export' && <ExportSettings />}
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
      className={`btn-base w-full px-3 py-2 rounded-lg text-sm text-left border ${
        active
          ? 'bg-surface-card text-text-primary border-border-default'
          : 'bg-transparent text-text-secondary border-transparent'
      }`}
    >
      {label}
    </button>
  )
}
