import { useEffect } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import { on } from '../stores/eventBus'

interface UseCanvasZoomOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
}

export function useCanvasZoom({ canvasRef, reactFlowInstance }: UseCanvasZoomOptions) {
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

    const SMOOTH_RATIO = 0.4
    const smoothWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      // This listener runs in the capture phase, immediately before React Flow's
      // d3-zoom handler. Scale the same event synchronously so d3 consumes the
      // softened delta; changing it in a later animation frame is already too late.
      Object.defineProperty(event, 'deltaY', {
        value: event.deltaY * SMOOTH_RATIO,
        writable: false,
      })
    }

    d3ZoomEl.addEventListener('wheel', smoothWheel, { capture: true, passive: false })
    el.addEventListener('mousedown', onRightDown, true)
    window.addEventListener('mouseup', onRightUp, true)
    return () => {
      d3ZoomEl.removeEventListener('wheel', smoothWheel, true)
      el.removeEventListener('mousedown', onRightDown, true)
      window.removeEventListener('mouseup', onRightUp, true)
      // Restore any remaining nopan classes
      for (const n of rightDownNodes) n.classList.add(NOPAN)
    }
  }, [canvasRef])
}
