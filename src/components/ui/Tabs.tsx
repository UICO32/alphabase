interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
            activeTab === tab.id
              ? 'bg-surface-card text-text-primary'
              : 'text-text-secondary'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
