import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'

const MIN_AUTO_CARD_HEIGHT = 120
const MAX_AUTO_CARD_HEIGHT = 800
const CARD_HEADER_HEIGHT = 36
const CARD_PADDING_V = 12
const HEIGHT_CHANGE_THRESHOLD = 5

export function useCardAutoHeight(
  nodeId: string,
  contentRef: React.RefObject<HTMLDivElement | null>,
  isEditing: boolean,
  fixedHeight: boolean | undefined,
) {
  const { setNodes } = useReactFlow()
  const lastManualResizeRef = useRef(0)

  useEffect(() => {
    if (fixedHeight) return
    const el = contentRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (Date.now() - lastManualResizeRef.current < 500) continue

        const contentHeight = entry.contentRect.height
        const newHeight = contentHeight + CARD_HEADER_HEIGHT + CARD_PADDING_V
        const clamped = Math.max(MIN_AUTO_CARD_HEIGHT, Math.min(MAX_AUTO_CARD_HEIGHT, Math.round(newHeight)))

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== nodeId) return n
            const prevHeight = (n.data as Record<string, unknown>).height as number | undefined
            if (prevHeight && Math.abs(prevHeight - clamped) < HEIGHT_CHANGE_THRESHOLD) return n
            return { ...n, data: { ...n.data, height: clamped } }
          }),
        )
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [nodeId, fixedHeight, isEditing, contentRef, setNodes])
}
