import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// 面板头部
interface PanelHeaderProps {
  title: string
  children?: React.ReactNode
}

export function PanelHeader({ title, children }: PanelHeaderProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      style={{ borderColor: surface.divider }}
    >
      <span className="font-medium text-sm" style={{ color: surface.text }}>
        {title}
      </span>
      {children}
    </div>
  )
}

// 侧边栏标签按钮
interface SideTabButtonProps {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
}

export function SideTabButton({ active, onClick, children, icon }: SideTabButtonProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full"
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

// 面板按钮
interface PanelButtonProps {
  onClick?: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

export function PanelButton({ onClick, children, variant = 'secondary', size = 'md', icon }: PanelButtonProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-sm',
  }

  const variantStyles = {
    primary: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
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
      className={`flex items-center gap-1.5 rounded-lg transition-colors ${sizeClasses[size]}`}
      style={variantStyles[variant]}
    >
      {icon}
      {children}
    </button>
  )
}

// 面板分隔线
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

// 面板区域
interface PanelSectionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export function PanelSection({ title, children, className = '' }: PanelSectionProps) {
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

// 展开图标按钮（折叠后显示）
interface ExpandButtonProps {
  direction: 'left' | 'right'
  onClick: () => void
}

export function ExpandButton({ direction, onClick }: ExpandButtonProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <button
      onClick={onClick}
      className="fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-8 h-12 rounded-lg shadow-lg transition-colors hover:opacity-90"
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

// 折叠按钮
interface CollapseButtonProps {
  direction: 'left' | 'right'
  onClick: () => void
}

export function CollapseButton({ direction, onClick }: CollapseButtonProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex items-center justify-center w-6 h-6 rounded transition-colors hover:opacity-70"
      style={{
        color: surface.muted,
      }}
    >
      {direction === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  )
}

// 空状态
interface EmptyStateProps {
  icon?: React.ReactNode
  text: string
  surface: ReturnType<typeof getPanelSurface>
}

export function EmptyState({ icon, text, surface }: EmptyStateProps) {
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

// 搜索输入框
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  surface: ReturnType<typeof getPanelSurface>
}

export function SearchInput({ value, onChange, placeholder = '搜索...', surface }: SearchInputProps) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
        style={{
          backgroundColor: surface.surface,
          color: surface.text,
          border: `1px solid ${surface.divider}`,
        }}
      />
    </div>
  )
}
