interface ConnectionButtonProps {
  visible: boolean
  onClick: (e: React.MouseEvent) => void
}

export function ConnectionButton({ visible, onClick }: ConnectionButtonProps) {
  return (
    <button
      className="absolute flex items-center justify-center rounded-full cursor-crosshair z-10 transition-all duration-150 shadow-md"
      style={{
        top: -14,
        right: -14,
        width: 28,
        height: 28,
        backgroundColor: 'var(--color-blue-500)',
        color: 'var(--text-inverse)',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        border: '3px solid var(--surface-app)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      +
    </button>
  )
}