export interface ContextMenuItem {
  icon?: React.ReactNode
  label?: string
  onClick?: () => void
  type?: 'separator'
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  return (
    <div
      className="fixed z-50 py-1 rounded-lg min-w-[160px] animate-scaleIn glass-panel"
      style={{
        left: x,
        top: y,
        boxShadow: 'var(--shadow-lg)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <div key={i} className="h-px my-1 bg-border-default" />
        ) : (
          <button
            key={i}
            className="btn-base flex items-center gap-2 px-3 py-1.5 w-full text-left text-sm text-text-primary"
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  )
}
