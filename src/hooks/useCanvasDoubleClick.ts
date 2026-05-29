import { useCallback } from 'react'
import { type Node } from '@xyflow/react'
import { useCardStore } from '../stores/cardStore'
import type { GlobalCard } from '../stores/cardStore'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../types/card'

interface UseCanvasDoubleClickOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  reactFlowInstance: React.RefObject<import('@xyflow/react').ReactFlowInstance | null>
  recordCurrentState: (deletedCardsContent?: Record<string, GlobalCard>) => void
  snapshotNow: (deletedCardsContent?: Record<string, GlobalCard>) => void
}

export function useCanvasDoubleClick({ nodes, setNodes, reactFlowInstance, recordCurrentState, snapshotNow }: UseCanvasDoubleClickOptions) {
  const addCard = useCardStore((s) => s.addCard)

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('.frame-node, .card-node-default')) return

    const instance = reactFlowInstance.current
    if (!instance) return

    snapshotNow()

    const position = instance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const cardId = crypto.randomUUID()
    const color = 'white'

    addCard({
      id: cardId,
      content: '[{"type":"heading","props":{"level":2},"content":[]}]',
      color,
      createdAt: Date.now(),
    })

    setNodes((nds) => [
      ...nds,
      {
        id: cardId,
        type: 'card',
        position,
        data: { cardId, color, width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT },
      },
    ])

    setTimeout(() => {
      recordCurrentState()
    }, 0)
  }, [nodes, setNodes, addCard, reactFlowInstance, recordCurrentState, snapshotNow])

  return { handleDoubleClick }
}