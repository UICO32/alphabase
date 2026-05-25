import { useEffect } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import { appEvents } from '../utils/appEvents'

interface UseCanvasZoomOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
}

export function useCanvasZoom({ canvasRef, reactFlowInstance }: UseCanvasZoomOptions) {
  useEffect(() => {
    const off1 = appEvents.on('hepta-zoom-in', () => reactFlowInstance.current?.zoomIn({ duration: 200 }))
    const off2 = appEvents.on('hepta-zoom-out', () => reactFlowInstance.current?.zoomOut({ duration: 200 }))
    const off3 = appEvents.on('hepta-fit-view', () => reactFlowInstance.current?.fitView({ duration: 200 }))
    return () => { off1(); off2(); off3() }
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