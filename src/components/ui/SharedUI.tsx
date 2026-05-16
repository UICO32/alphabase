import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b transition-theme"
      style={{ borderColor: surface.divider }}
    >
      <span className="font-medium text-sm" style={{ color: surface.text }}>
        {title}
      </span>
      {children}
    </div>
  )
}

export function SideTabButton({ active, onClick, children, icon }: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

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
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

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

export function PanelSeparator() {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <div
      className="h-px my-2"
      style={{ backgroundColor: surface.divider }}
    />
  )
}

export function PanelSection({ title, children, className = '' }: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <div className={`px-4 py-3 ${className}`}>
      {title && (
        <div
          className="text-xs font-medium mb-2 uppercase tracking-wide"
          style={{ color: surface.muted }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

export function ExpandButton({ direction, onClick }: {
  direction: 'left' | 'right'
  onClick: () => void
}) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <button
      onClick={onClick}
      className="btn-base fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-8 h-12 rounded-lg hover:shadow-xl"
      style={{
        backgroundColor: surface.panelBg,
        color: surface.text,
        left: direction === 'left' ? '0' : undefined,
        right: direction === 'right' ? '0' : undefined,
        boxShadow: surface.shadow,
      }}
    >
      {direction === 'left' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  )
}

export function CollapseButton({ direction, onClick }: {
  direction: 'left' | 'right'
  onClick: () => void
}) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="btn-base flex items-center justify-center w-6 h-6 rounded"
      style={{ color: surface.muted }}
    >
      {direction === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  )
}

export function EmptyState({ icon, text, surface }: {
  icon?: React.ReactNode
  text: string
  surface: ReturnType<typeof getPanelSurface>
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      {icon && (
        <div className="mb-3" style={{ color: surface.muted }}>
          {icon}
        </div>
      )}
      <div className="text-sm" style={{ color: surface.muted }}>
        {text}
      </div>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = '搜索...' }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          backgroundColor: 'var(--surface-input)',
          color: 'var(--text-primary)',
          border: `1px solid var(--border-default)`,
        }}
      />
    </div>
  )
}
