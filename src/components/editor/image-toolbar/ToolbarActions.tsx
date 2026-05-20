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
  surface,
  cropping,
  toolbarRef,
  onMouseEnter,
  onMouseLeave,
  onPointerDown,
}: ToolbarActionsProps) {
  const { isDark } = surface

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: isDark ? '#e2e8f0' : '#475569',
    cursor: 'pointer',
    padding: 0,
  }

  return (
    <div
      ref={toolbarRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex',
        gap: 2,
        padding: 3,
        borderRadius: 8,
        background: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)',
        border: `1px solid ${isDark ? 'rgba(51,65,85,0.8)' : 'rgba(226,232,240,0.9)'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
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
          background: cropping ? (isDark ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.15)') : 'transparent',
        }}
        onClick={onCrop}
        title="裁切图片"
      >
        <Crop size={14} />
      </button>
    </div>
  )
}
