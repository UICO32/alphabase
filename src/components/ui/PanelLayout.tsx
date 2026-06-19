import { ChevronLeft, ChevronRight } from 'lucide-react'

export function PanelSeparator() {
  return (
    <div className="h-px my-2 bg-border-default" />
  )
}

export function PanelSection({ title, children, className = '' }: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`px-4 py-3 ${className}`}>
      {title && (
        <div className="text-xs font-medium mb-2 uppercase tracking-wide text-fg-secondary">
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
  return (
    <button
      onClick={onClick}
      className="btn-base fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-8 h-12 rounded-lg hover:shadow-xl glass-panel text-fg-primary"
      style={{
        left: direction === 'left' ? '0' : undefined,
        right: direction === 'right' ? '0' : undefined,
        boxShadow: 'var(--shadow-lg)',
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
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="btn-base flex items-center justify-center w-6 h-6 rounded text-fg-secondary"
    >
      {direction === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  )
}
