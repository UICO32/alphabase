import { useEffect } from 'react'
import type { ReactFlowInstance, Viewport } from '@xyflow/react'
import { on } from '../stores/eventBus'

interface UseCanvasZoomOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  minZoom?: number
  maxZoom?: number
  onViewportChange?: (viewport: Viewport) => void
  onViewportSettled?: (viewport: Viewport) => void
}

const WHEEL_SENSITIVITY = 0.55
const FOLLOW_ALPHA = 0.62
const COMMIT_DELAY_MS = 96
const ZOOM_EPSILON = 0.001

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isViewportSettled(current: Viewport, target: Viewport) {
  return Math.abs(current.x - target.x) < ZOOM_EPSILON
    && Math.abs(current.y - target.y) < ZOOM_EPSILON
    && Math.abs(current.zoom - target.zoom) < ZOOM_EPSILON
}

export function useCanvasZoom({
  canvasRef,
  reactFlowInstance,
  minZoom = 0.1,
  maxZoom = 4,
  onViewportChange,
  onViewportSettled,
}: UseCanvasZoomOptions) {
  useEffect(() => {
    const off1 = on('zoom-in', () => reactFlowInstance.current?.zoomIn({ duration: 200 }))
    const off2 = on('zoom-out', () => reactFlowInstance.current?.zoomOut({ duration: 200 }))
    const off3 = on('fit-view', () => reactFlowInstance.current?.fitView({ duration: 200 }))
    return () => { off1(); off2(); off3() }
  }, [on, reactFlowInstance])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const paneEl = el.querySelector('.react-flow__pane') as HTMLElement | null
    if (!paneEl) return

    const d3ZoomEl = paneEl.parentElement
    if (!d3ZoomEl) return
    const viewportEl = el.querySelector('.react-flow__viewport') as HTMLElement | null

    // Allow right-click pan on nodes by temporarily removing 'nopan' class.
    // React Flow adds 'nopan' to draggable nodes, which makes d3-zoom reject
    // pointer events on them. By removing it during right-click, the pan
    // gesture reaches d3-zoom even when the cursor is over a node.
    const NOPAN = 'nopan'
    const rightDownNodes: Element[] = []

    const onRightDown = (e: MouseEvent) => {
      if (e.button !== 2) return
      const target = e.target as Element
      const node = target.closest('.react-flow__node')
      if (!node || !node.classList.contains(NOPAN)) return
      node.classList.remove(NOPAN)
      rightDownNodes.push(node)
    }

    const onRightUp = (e: MouseEvent) => {
      if (e.button !== 2) return
      // Re-add nopan after a microtask so d3-zoom finishes its mouseup handling
      const nodes = rightDownNodes.splice(0)
      queueMicrotask(() => {
        for (const n of nodes) n.classList.add(NOPAN)
      })
    }

    let animationFrame: number | null = null
    let targetViewport: Viewport | null = null
    let visualViewport: Viewport | null = null
    let commitTimer: number | null = null

    const applyVisualViewport = (viewport: Viewport) => {
      if (viewportEl) {
        viewportEl.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
      }
      onViewportChange?.(viewport)
    }

    const commitTargetViewport = () => {
      const instance = reactFlowInstance.current
      const target = targetViewport
      if (!instance || !target) return
      if (commitTimer !== null) {
        window.clearTimeout(commitTimer)
        commitTimer = null
      }
      applyVisualViewport(target)
      visualViewport = null
      targetViewport = null
      onViewportSettled?.(target)
      void instance.setViewport(target, { duration: 0 })
    }

    const animateToTarget = () => {
      animationFrame = null
      const instance = reactFlowInstance.current
      const target = targetViewport
      if (!instance || !target) return

      const current = visualViewport ?? instance.getViewport()
      if (isViewportSettled(current, target)) {
        commitTargetViewport()
        return
      }

      const next = {
        x: current.x + (target.x - current.x) * FOLLOW_ALPHA,
        y: current.y + (target.y - current.y) * FOLLOW_ALPHA,
        zoom: current.zoom + (target.zoom - current.zoom) * FOLLOW_ALPHA,
      }
      visualViewport = next
      applyVisualViewport(next)
      animationFrame = requestAnimationFrame(animateToTarget)
    }

    const scheduleAnimation = () => {
      if (animationFrame !== null) return
      animationFrame = requestAnimationFrame(animateToTarget)
    }

    const smoothWheel = (event: WheelEvent) => {
      // Keep browser pinch-zoom semantics unchanged.
      if (event.ctrlKey || event.deltaY === 0) return

      const instance = reactFlowInstance.current
      if (!instance) return

      const current = targetViewport ?? visualViewport ?? instance.getViewport()
      if (!visualViewport) visualViewport = current
      const rect = el.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const flowX = (pointerX - current.x) / current.zoom
      const flowY = (pointerY - current.y) / current.zoom
      const deltaFactor = event.deltaMode === 1 ? 0.05 : event.deltaMode === 2 ? 1 : 0.002
      const zoomDelta = -event.deltaY * deltaFactor * WHEEL_SENSITIVITY
      const nextZoom = clamp(current.zoom * (2 ** zoomDelta), minZoom, maxZoom)

      targetViewport = {
        x: pointerX - flowX * nextZoom,
        y: pointerY - flowY * nextZoom,
        zoom: nextZoom,
      }
      if (commitTimer !== null) window.clearTimeout(commitTimer)
      commitTimer = window.setTimeout(() => {
        commitTimer = null
        commitTargetViewport()
      }, COMMIT_DELAY_MS)

      // React Flow's d3-zoom applies a discrete step immediately. Stop that
      // handler and let the rAF loop converge on the accumulated target instead.
      event.preventDefault()
      event.stopImmediatePropagation()
      scheduleAnimation()
    }

    d3ZoomEl.addEventListener('wheel', smoothWheel, { capture: true, passive: false })
    el.addEventListener('mousedown', onRightDown, true)
    window.addEventListener('mouseup', onRightUp, true)
    return () => {
      d3ZoomEl.removeEventListener('wheel', smoothWheel, true)
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      if (commitTimer !== null) window.clearTimeout(commitTimer)
      targetViewport = null
      visualViewport = null
      el.removeEventListener('mousedown', onRightDown, true)
      window.removeEventListener('mouseup', onRightUp, true)
      // Restore any remaining nopan classes
      for (const n of rightDownNodes) n.classList.add(NOPAN)
    }
  }, [canvasRef, maxZoom, minZoom, onViewportChange, onViewportSettled, reactFlowInstance])
}
