import { useCallback, useRef } from 'react'

interface Surface {
  isDark: boolean
}

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface CropOverlayProps {
  target: HTMLImageElement
  surface: Surface
  cropRect: CropRect | null
  onCropRectChange: (rect: CropRect | null) => void
  onApplyCrop: () => void
  onCancelCrop: () => void
}

export function CropOverlay({
  target,
  surface,
  cropRect,
  onCropRectChange,
  onApplyCrop,
  onCancelCrop,
}: CropOverlayProps) {
  const cropStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleCropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const imgRect = target.getBoundingClientRect()
      cropStartRef.current = { x: e.clientX - imgRect.left, y: e.clientY - imgRect.top }
      onCropRectChange({ x: e.clientX - imgRect.left, y: e.clientY - imgRect.top, w: 0, h: 0 })

      const handleMove = (ev: MouseEvent) => {
        if (!cropStartRef.current) return
        const sx = cropStartRef.current.x
        const sy = cropStartRef.current.y
        const cx = ev.clientX - imgRect.left
        const cy = ev.clientY - imgRect.top
        onCropRectChange({
          x: Math.min(sx, cx),
          y: Math.min(sy, cy),
          w: Math.abs(cx - sx),
          h: Math.abs(cy - sy),
        })
      }

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
        cropStartRef.current = null
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [target, onCropRectChange],
  )

  const imgRect = target.getBoundingClientRect()

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: imgRect.top,
    left: imgRect.left,
    width: imgRect.width,
    height: imgRect.height,
    zIndex: 10000,
    cursor: 'crosshair',
    pointerEvents: 'auto',
  }

  return (
    <div style={overlayStyle} onMouseDown={handleCropMouseDown}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}
      />
      {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
        <div
          style={{
            position: 'absolute',
            left: cropRect.x,
            top: cropRect.y,
            width: cropRect.w,
            height: cropRect.h,
            border: '2px solid var(--color-accent-blue)',
            background: 'transparent',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          bottom: -36,
          right: 0,
          display: 'flex',
          gap: 4,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onApplyCrop()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            borderRadius: 6,
            border: 'none',
            background: 'var(--color-accent-blue)',
            color: 'var(--fg-inverse)',
            cursor: 'pointer',
          }}
        >
          确认
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCancelCrop()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid var(--line-default)',
            background: 'var(--surface-card)',
            color: 'var(--fg-secondary)',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </div>
    </div>
  )
}
