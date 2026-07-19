import { Copy, Crop, Download } from 'lucide-react'

interface Surface {
  isDark: boolean
}

interface ToolbarActionsProps {
  onCopy: () => void
  onDownload: () => void
  onCrop: () => void
  surface: Surface
  cropping: boolean
  toolbarRef: React.RefObject<HTMLDivElement>
  onMouseEnter: () => void
  onMouseLeave: () => void
  onPointerDown: (e: React.PointerEvent) => void
}

export function ToolbarActions({
  onCopy,
  onDownload,
  onCrop,
  cropping,
  toolbarRef,
  onMouseEnter,
  onMouseLeave,
  onPointerDown,
}: ToolbarActionsProps) {
  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--fg-secondary)',
    cursor: 'pointer',
    padding: 0,
  }

  return (
    <div
      ref={toolbarRef}
      className="ui-floating-surface"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex',
        gap: 2,
        padding: 3,
        borderRadius: 8,
        pointerEvents: 'auto',
      }}
      onPointerDown={onPointerDown}
    >
      <button style={btnStyle} onClick={onCopy} title="复制图片">
        <Copy size={14} />
      </button>
      <button style={btnStyle} onClick={onDownload} title="下载图片">
        <Download size={14} />
      </button>
      <button
        style={{
          ...btnStyle,
          background: cropping ? 'var(--color-accent-blue)' : 'transparent',
        }}
        onClick={onCrop}
        title="裁切图片"
      >
        <Crop size={14} />
      </button>
    </div>
  )
}
