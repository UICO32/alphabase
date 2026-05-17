import { ChevronRight } from 'lucide-react'
import { useIsDarkMode } from '../../../hooks/useIsDarkMode'

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  hasSubmenu?: boolean
}

export function MenuItem({ icon, label, onClick, danger, hasSubmenu }: MenuItemProps) {
  const isDarkMode = useIsDarkMode()
  return (
    <button
      className="flex items-center gap-2 w-full text-left"
      style={{
        padding: '5px 12px',
        fontSize: 12,
        color: danger ? 'var(--text-danger)' : isDarkMode ? '#e4e4e7' : '#18181b',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 4,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = danger
          ? 'rgba(239,68,68,0.1)'
          : isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {hasSubmenu && <ChevronRight size={12} />}
    </button>
  )
}