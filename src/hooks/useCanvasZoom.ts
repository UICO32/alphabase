import { useEffect } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'

interface UseCanvasZoomOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
}

export function useCanvasZoom({ canvasRef, reactFlowInstance }: UseCanvasZoomOptions) {
  useEffect(() => {
    const onZoomIn = () => reactFlowInstance.current?.zoomIn({ duration: 200 })
    const onZoomOut = () => reactFlowInstance.current?.zoomOut({ duration: 200 })
    const onFitView = () => reactFlowInstance.current?.fitView({ duration: 200 })

    window.addEventListener('hepta-zoom-in', onZoomIn)
    window.addEventListener('hepta-zoom-out', onZoomOut)
    window.addEventListener('hepta-fit-view', onFitView)
    return () => {
      window.removeEventListener('hepta-zoom-in', onZoomIn)
      window.removeEventListener('hepta-zoom-out', onZoomOut)
      window.removeEventListener('hepta-fit-view', onFitView)
    }
  }, [reactFlowInstance])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const paneEl = el.querySelector('.react-flow__pane') as HTMLElement | null
    if (!paneEl) return

    const d3ZoomEl = paneEl.parentElement
    if (!d3ZoomEl) return

    const SMOOTH_RATIO = 0.4

    const smoothWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      Object.defineProperty(event, 'deltaY', {
        value: event.deltaY * SMOOTH_RATIO,
        writable: false,
      })
    }

    d3ZoomEl.addEventListener('wheel', smoothWheel, { capture: true })
    return () => {
      d3ZoomEl.removeEventListener('wheel', smoothWheel, true)
    }
  }, [canvasRef])
}