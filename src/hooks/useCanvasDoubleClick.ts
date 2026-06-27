import { useCallback, useRef } from 'react'
import { type Node } from '@xyflow/react'
import { useCardStore } from '../stores/cardStore'
import type { GlobalCard } from '../stores/cardStore'
import { useViewStore } from '../stores/viewStore'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, DEFAULT_CARD_CONTENT } from '../types/card'

interface UseCanvasDoubleClickOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  reactFlowInstance: React.RefObject<import('@xyflow/react').ReactFlowInstance | null>
  recordCurrentState: (deletedCardsContent?: Record<string, GlobalCard>) => void
  snapshotNow: (deletedCardsContent?: Record<string, GlobalCard>) => void
}

export function useCanvasDoubleClick({ nodes, setNodes, reactFlowInstance, recordCurrentState, snapshotNow }: UseCanvasDoubleClickOptions) {
  const addCard = useCardStore((s) => s.addCard)

  // Track whether the last mousedown was on a card/frame — if so, the dblclick
  // is a "card → blank" or "blank → card" double-click and should not create a card.
  const lastClickOnNode = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    lastClickOnNode.current = !!(e.target as HTMLElement).closest('.frame-node, .card-node-default')
  }, [])

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    // Either click of the dblclick landed on a card/frame — ignore
    if (lastClickOnNode.current || (event.target as HTMLElement).closest('.frame-node, .card-node-default')) return

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
      content: DEFAULT_CARD_CONTENT,
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

    useViewStore.getState().setAutoEditCardId(cardId)
    useViewStore.getState().setEditingCardId(cardId)

    setTimeout(() => {
      recordCurrentState()
    }, 0)
  }, [nodes, setNodes, addCard, reactFlowInstance, recordCurrentState, snapshotNow])

  return { handleDoubleClick, handleMouseDown }
}