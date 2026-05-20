import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ToolbarActions } from './image-toolbar/ToolbarActions'
import { CropOverlay } from './image-toolbar/CropOverlay'

interface ToolbarPosition {
  top: number
  left: number
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
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const portalContainerRef = useRef<HTMLDivElement | null>(null)

  const surface = { isDark: theme === 'dark' }

  // 创建 portal 容器
  useEffect(() => {
    const portal = document.createElement('div')
    portal.style.position = 'fixed'
    portal.style.top = '0'
    portal.style.left = '0'
    portal.style.width = '100%'
    portal.style.height = '100%'
    portal.style.pointerEvents = 'none'
    portal.style.zIndex = '9999'
    portal.id = 'image-toolbar-portal'
    document.body.appendChild(portal)
    portalContainerRef.current = portal

    return () => {
      document.body.removeChild(portal)
      portalContainerRef.current = null
    }
  }, [])

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

  // 计算工具栏位置（相对于视口）
  const updatePosition = useCallback(() => {
    if (!target || !containerRef.current) return

    const imgRect = target.getBoundingClientRect()
    const toolbarHeight = 36
    const toolbarWidth = 100

    let top = imgRect.top - toolbarHeight - 8
    let left = imgRect.right - toolbarWidth

    if (top < 8) {
      top = imgRect.bottom + 8
    }
    if (left < 8) {
      left = 8
    }
    if (left + toolbarWidth > window.innerWidth - 8) {
      left = window.innerWidth - toolbarWidth - 8
    }

    setPos({ top, left })
  }, [target, containerRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !editable) return

    const handleMouseOver = (e: MouseEvent) => {
      const img = (e.target as HTMLElement).closest('.bn-visual-media') as HTMLImageElement | null
      if (!img || !el.contains(img)) return
      clearHideTimer()
      setTarget(img)
      requestAnimationFrame(updatePosition)
    }

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null
      if (related && (toolbarRef.current?.contains(related) || related.closest('.bn-visual-media'))) return
      scheduleHide()
    }

    const handleScroll = () => {
      if (target) {
        updatePosition()
      }
    }

    el.addEventListener('mouseover', handleMouseOver)
    el.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)

    return () => {
      el.removeEventListener('mouseover', handleMouseOver)
      el.removeEventListener('mouseout', handleMouseOut)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
      clearHideTimer()
    }
  }, [containerRef, editable, clearHideTimer, scheduleHide, target, updatePosition])

  useLayoutEffect(() => {
    if (target) {
      updatePosition()
    }
  }, [target, updatePosition])

  const handleToolbarMouseEnter = useCallback(() => clearHideTimer(), [clearHideTimer])
  const handleToolbarMouseLeave = useCallback(() => scheduleHide(), [scheduleHide])

  const handleCopy = useCallback(async () => {
    if (!target) return
    try {
      const src = target.src
      const res = await fetch(src)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {
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

  if (!target || !pos || !portalContainerRef.current) return null

  const toolbarContent = (
    <>
      <div
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 9999,
        }}
      >
        <ToolbarActions
          onCopy={handleCopy}
          onDownload={handleDownload}
          onCrop={handleStartCrop}
          surface={surface}
          cropping={cropping}
          toolbarRef={toolbarRef}
          onMouseEnter={handleToolbarMouseEnter}
          onMouseLeave={handleToolbarMouseLeave}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>

      {cropping && (
        <CropOverlay
          target={target}
          surface={surface}
          cropRect={cropRect}
          onCropRectChange={setCropRect}
          onApplyCrop={applyCrop}
          onCancelCrop={cancelCrop}
        />
      )}
    </>
  )

  return createPortal(toolbarContent, portalContainerRef.current)
}
