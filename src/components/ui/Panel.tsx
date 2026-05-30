import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface PanelProps {
  title?: string
  children: React.ReactNode
  collapsible?: boolean
  className?: string
}

export function Panel({ title, children, collapsible = false, className = '' }: PanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`bg-surface-panel glass-panel rounded-lg ${className}`}>
      {title && (
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-border-default transition-theme ${collapsible ? 'cursor-pointer' : ''}`}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
        >
          <span className="font-medium text-sm text-text-primary">{title}</span>
          {collapsible && (
            <ChevronDown
              size={14}
              className={`text-text-secondary transition-transform ${collapsed ? '' : 'rotate-180'}`}
            />
          )}
        </div>
      )}
      {!collapsed && (
        <div className="p-4">{children}</div>
      )}
    </div>
  )
}
