import { useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useCardStore } from '../stores/cardStore'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../types/card'

interface UseCanvasDoubleClickOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  reactFlowInstance: React.RefObject<import('@xyflow/react').ReactFlowInstance | null>
  recordCurrentState: (type: 'canvas' | 'structure', description: string) => void
}

export function useCanvasDoubleClick({ nodes, setNodes, reactFlowInstance, recordCurrentState }: UseCanvasDoubleClickOptions) {
  const addCard = useCardStore((s) => s.addCard)

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    const instance = reactFlowInstance.current
    if (!instance) return

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
      recordCurrentState('structure', '双击创建卡片')
    }, 0)
  }, [nodes, setNodes, addCard, reactFlowInstance, recordCurrentState])

  return { handleDoubleClick }
}