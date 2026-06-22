import type { ReactNode } from 'react'

interface MenuItemProps {
  icon: ReactNode
  label: string
  onClick: () => void
  hasSubmenu?: boolean
}

export function MenuItem({ icon, label, onClick, hasSubmenu }: MenuItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: 13,
        userSelect: 'none',
      }}
    >
      <span style={{ width: 16, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {hasSubmenu && (
        <span style={{ marginLeft: 'auto', opacity: 0.4 }}>›</span>
      )}
    </div>
  )
}
