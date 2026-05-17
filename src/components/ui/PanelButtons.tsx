import { usePanelSurface } from '../../hooks/usePanelSurface'

export function SideTabButton({ active, onClick, children, icon }: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  const surface = usePanelSurface()

  return (
    <button
      onClick={onClick}
      className="panel-tab panel-tab-hover flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full"
      style={{
        backgroundColor: active ? surface.surface : 'transparent',
        color: active ? surface.text : surface.muted,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

export function PanelButton({ onClick, children, variant = 'secondary', size = 'md', icon }: {
  onClick?: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}) {
  const surface = usePanelSurface()

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-sm',
  }

  const variantStyles = {
    primary: {
      backgroundColor: 'var(--color-blue-500)',
      color: 'var(--text-inverse)',
    },
    secondary: {
      backgroundColor: surface.surface,
      color: surface.text,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: surface.muted,
    },
  }

  return (
    <button
      onClick={onClick}
      className={`btn-base flex items-center gap-1.5 rounded-lg ${sizeClasses[size]}`}
      style={variantStyles[variant]}
    >
      {icon}
      {children}
    </button>
  )
}
