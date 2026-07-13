import { useCallback } from 'react'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import { useBoardStore } from '../../stores/boardStore'
import { emit } from '../../stores/eventBus'
import { useCardStore, type GlobalCard } from '../../stores/cardStore'
import {
  COLLAPSED_CARD_HEIGHT,
  DEFAULT_CARD_HEIGHT,
  type CardColor,
  type CardNodeData,
} from '../../types/card'

type SetNodes = ReactFlowInstance<Node, Edge>['setNodes']
type SetEdges = ReactFlowInstance<Node, Edge>['setEdges']
type GetNode = ReactFlowInstance<Node, Edge>['getNode']
type UpdateCard = (id: string, props: Partial<GlobalCard>) => void

interface UseCardNodeActionsArgs {
  cardId: string
  isCollapsed: boolean
  updateCard: UpdateCard
  setNodes: SetNodes
  setEdges: SetEdges
  getNode: GetNode
}

export function useCardNodeActions({
  cardId,
  isCollapsed,
  updateCard,
  setNodes,
  setEdges,
  getNode,
}: UseCardNodeActionsArgs) {
  const handleToggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed
    updateCard(cardId, { collapsed: newCollapsed })
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== cardId) return n
        if (newCollapsed) {
          const prevHeight = n.height ?? n.measured?.height ?? DEFAULT_CARD_HEIGHT
          return {
            ...n,
            data: { ...n.data, collapsed: true, prevHeight },
            height: COLLAPSED_CARD_HEIGHT,
          }
        }
        const prevHeight = (n.data as CardNodeData).prevHeight as number | undefined
        return {
          ...n,
          data: { ...n.data, collapsed: false },
          height: prevHeight ?? DEFAULT_CARD_HEIGHT,
        }
      }),
    )
  }, [cardId, isCollapsed, updateCard, setNodes])

  const handleColorChange = useCallback((newColor: CardColor) => {
    updateCard(cardId, { color: newColor })
    setNodes((nds) =>
      nds.map((n) =>
        n.id === cardId
          ? { ...n, data: { ...n.data, color: newColor } }
          : n,
      ),
    )
  }, [cardId, updateCard, setNodes])

  const handleRemoveFromBoard = useCallback(() => {
    const cardData = useCardStore.getState().cards[cardId]
    if (cardData) {
      emit('remove-card-from-board', { cardId, cardContent: cardData })
    }
    setNodes((nds) => nds.filter((n) => n.id !== cardId))
    setEdges((eds) => eds.filter((e) => e.source !== cardId && e.target !== cardId))
  }, [cardId, setNodes, setEdges])

  const handleMoveToBoard = useCallback((boardId: string) => {
    const node = getNode(cardId)
    if (!node) return

    const nodeData = node.data as CardNodeData
    const nodeWidth = nodeData.width
    const nodeHeight = nodeData.height

    setNodes((nds) => nds.filter((n) => n.id !== cardId))
    setEdges((eds) => {
      const relatedEdges = eds.filter((e) => e.source === cardId || e.target === cardId)
      const remainingEdges = eds.filter((e) => e.source !== cardId && e.target !== cardId)

      const boardStore = useBoardStore.getState()
      const targetData = boardStore.getBoardData(boardId) || { nodes: [], edges: [] }
      targetData.nodes.push({
        id: node.id,
        type: (node.type || 'card') as 'card' | 'frame' | 'media',
        position: { x: node.position.x, y: node.position.y },
        data: { ...node.data },
        width: nodeWidth,
        height: nodeHeight,
      })
      targetData.edges.push(...relatedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        type: e.type,
      })))
      boardStore.saveBoardData(boardId, targetData)

      return remainingEdges
    })
  }, [cardId, getNode, setNodes, setEdges])

  return {
    handleToggleCollapse,
    handleColorChange,
    handleRemoveFromBoard,
    handleMoveToBoard,
  }
}
