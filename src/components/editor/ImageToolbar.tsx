import { useEffect, useRef, useState, useCallback } from 'react'
import { Copy, Crop, Download } from 'lucide-react'

interface ToolbarPosition {
  top: number
  right: number
}

interface ImageToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  editable: boolean
  theme: 'light' | 'dark'
  onDeleteImage?: (imgEl: HTMLImageElement) => void
}

export function ImageToolbar({ containerRef, editable, theme }: ImageToolbarProps) {
  const [target, setTarget] = useState<HTMLImageElement | null>(null)
  const [pos, setPos] = useState<ToolbarPosition | null>(null)
  const [cropping, setCropping] = useState(false)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const cropStartRef = useRef<{ x: number; y: number } | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => {
      setTarget(null)
      setPos(null)
      setCropping(false)
      setCropRect(null)
    }, 200)
  }, [clearHideTimer])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !editable) return

    const handleMouseOver = (e: MouseEvent) => {
      const img = (e.target as HTMLElement).closest('.bn-visual-media') as HTMLImageElement | null
      if (!img || !el.contains(img)) return
      clearHideTimer()
      setTarget(img)
      const containerRect = el.getBoundingClientRect()
      const imgRect = img.getBoundingClientRect()
      setPos({
        top: imgRect.top - containerRect.top + 6,
        right: containerRect.right - imgRect.right + 6,
      })
    }

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null
      if (related && (toolbarRef.current?.contains(related) || related.closest('.bn-visual-media'))) return
      scheduleHide()
    }

    el.addEventListener('mouseover', handleMouseOver)
    el.addEventListener('mouseout', handleMouseOut)
    return () => {
      el.removeEventListener('mouseover', handleMouseOver)
      el.removeEventListener('mouseout', handleMouseOut)
      clearHideTimer()
    }
  }, [containerRef, editable, clearHideTimer, scheduleHide])

  const handleToolbarMouseEnter = useCallback(() => clearHideTimer(), [clearHideTimer])
  const handleToolbarMouseLeave = useCallback(() => scheduleHide(), [scheduleHide])

  const handleCopy = useCallback(async () => {
    if (!target) return
    try {
      const src = target.src
      if (src.startsWith('data:')) {
        const res = await fetch(src)
        const blob = await res.blob()
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      } else {
        const res = await fetch(src)
        const blob = await res.blob()
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      }
    } catch {
      // fallback: copy image URL
      if (target.src) {
        await navigator.clipboard.writeText(target.src).catch(() => {})
      }
    }
  }, [target])

  const handleDownload = useCallback(() => {
    if (!target) return
    const a = document.createElement('a')
    a.href = target.src
    a.download = 'image'
    a.click()
  }, [target])

  const handleStartCrop = useCallback(() => {
    setCropping(true)
    setCropRect(null)
  }, [])

  const handleCropMouseDown = useCallback((e: React.MouseEvent) => {
    if (!target) return
    const imgRect = target.getBoundingClientRect()
    cropStartRef.current = { x: e.clientX - imgRect.left, y: e.clientY - imgRect.top }
    setCropRect({ x: e.clientX - imgRect.left, y: e.clientY - imgRect.top, w: 0, h: 0 })

    const handleMove = (ev: MouseEvent) => {
      if (!cropStartRef.current) return
      const sx = cropStartRef.current.x
      const sy = cropStartRef.current.y
      const cx = ev.clientX - imgRect.left
      const cy = ev.clientY - imgRect.top
      setCropRect({
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
  }, [target])

  const applyCrop = useCallback(() => {
    if (!target || !cropRect || cropRect.w < 10 || cropRect.h < 10) {
      setCropping(false)
      setCropRect(null)
      return
    }

    const imgRect = target.getBoundingClientRect()
    const scaleX = target.naturalWidth / imgRect.width
    const scaleY = target.naturalHeight / imgRect.height

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(cropRect.w * scaleX)
    canvas.height = Math.round(cropRect.h * scaleY)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(
      target,
      Math.round(cropRect.x * scaleX),
      Math.round(cropRect.y * scaleY),
      canvas.width,
      canvas.height,
      0, 0,
      canvas.width,
      canvas.height,
    )

    target.src = canvas.toDataURL('image/png')
    setCropping(false)
    setCropRect(null)
  }, [target, cropRect])

  const cancelCrop = useCallback(() => {
    setCropping(false)
    setCropRect(null)
  }, [])

  if (!target || !pos) return null

  const isDark = theme === 'dark'
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
    <>
      <div
        ref={toolbarRef}
        onMouseEnter={handleToolbarMouseEnter}
        onMouseLeave={handleToolbarMouseLeave}
        style={{
          position: 'absolute',
          top: pos.top,
          right: pos.right,
          zIndex: 50,
          display: 'flex',
          gap: 2,
          padding: 3,
          borderRadius: 8,
          background: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)',
          border: `1px solid ${isDark ? 'rgba(51,65,85,0.8)' : 'rgba(226,232,240,0.9)'}`,
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
          pointerEvents: 'auto',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button style={btnStyle} onClick={handleCopy} title="复制图片">
          <Copy size={14} />
        </button>
        <button style={btnStyle} onClick={handleDownload} title="下载图片">
          <Download size={14} />
        </button>
        <button style={btnStyle} onClick={handleStartCrop} title="裁切图片">
          <Crop size={14} />
        </button>
      </div>

      {cropping && target && (() => {
        const containerEl = containerRef.current
        if (!containerEl) return null
        const containerRect = containerEl.getBoundingClientRect()
        const imgRect = target.getBoundingClientRect()
        const overlayStyle: React.CSSProperties = {
          position: 'absolute',
          top: imgRect.top - containerRect.top,
          left: imgRect.left - containerRect.left,
          width: imgRect.width,
          height: imgRect.height,
          zIndex: 60,
          cursor: 'crosshair',
        }
        return (
          <div style={overlayStyle} onMouseDown={handleCropMouseDown}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }} />
            {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
              <div style={{
                position: 'absolute',
                left: cropRect.x,
                top: cropRect.y,
                width: cropRect.w,
                height: cropRect.h,
                border: '2px solid #3b82f6',
                background: 'transparent',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                pointerEvents: 'none',
              }} />
            )}
            <div style={{
              position: 'absolute',
              bottom: -36,
              right: 0,
              display: 'flex',
              gap: 4,
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); applyCrop() }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: 'none',
                  background: '#3b82f6',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                确认
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); cancelCrop() }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                  background: isDark ? '#1e293b' : '#fff',
                  color: isDark ? '#e2e8f0' : '#475569',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>
        )
      })()}
    </>
  )
}
