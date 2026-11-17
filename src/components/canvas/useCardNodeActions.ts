import { useCallback } from 'react'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import { useBoardStore } from '../../stores/boardStore'
import { emit } from '../../stores/eventBus'
import { useCardStore, type GlobalCard } from '../../stores/cardStore'
import { getActiveSyncEngine } from '../../sync/syncEngineRef'
import { serializeBoardData } from '../../sync/boardSnapshot'
import { DEFAULT_BOARD_VIEWPORT, type BoardEdge, type BoardNode } from '../../utils/workspace/types'
import {
  COLLAPSED_CARD_HEIGHT,
  DEFAULT_CARD_HEIGHT,
  type CardColor,
  type CardNodeData,
} from '../../types/card'

type SetNodes = ReactFlowInstance<Node, Edge>['setNodes']
type SetEdges = ReactFlowInstance<Node, Edge>['setEdges']
type GetNode = ReactFlowInstance<Node, Edge>['getNode']
type GetEdges = ReactFlowInstance<Node, Edge>['getEdges']
type UpdateCard = (id: string, props: Partial<GlobalCard>) => void

interface UseCardNodeActionsArgs {
  cardId: string
  isCollapsed: boolean
  updateCard: UpdateCard
  setNodes: SetNodes
  setEdges: SetEdges
  getNode: GetNode
  getEdges: GetEdges
}

export function useCardNodeActions({
  cardId,
  isCollapsed,
  updateCard,
  setNodes,
  setEdges,
  getNode,
  getEdges,
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

    const currentEdges = getEdges()
    const relatedEdges = currentEdges.filter((e) => e.source === cardId || e.target === cardId)
    const remainingEdges = currentEdges.filter((e) => e.source !== cardId && e.target !== cardId)

    // 与常规落盘共用同一套序列化，保证移动过去的节点/边和目标画板自己保存的形态一致。
    const moved = serializeBoardData([node], relatedEdges)
    const boardStore = useBoardStore.getState()
    const targetData = boardStore.getBoardData(boardId) ?? { nodes: [], edges: [] }

    // 目标画板可能已有同一节点/边（重复触发或并发重放）：按 id 去重，保证幂等。
    // boardData 里存的本来就是序列化后的 BoardNode/BoardEdge，只是 store 类型写宽了。
    const previousNodes = targetData.nodes as BoardNode[]
    const previousEdges = targetData.edges as BoardEdge[]
    const targetNodeIds = new Set(previousNodes.map((n) => n.id))
    const targetEdgeIds = new Set(previousEdges.map((e) => e.id))
    const nextTargetNodes: BoardNode[] = [...previousNodes, ...moved.nodes.filter((n) => !targetNodeIds.has(n.id))]
    const nextTargetEdges: BoardEdge[] = [...previousEdges, ...moved.edges.filter((e) => !targetEdgeIds.has(e.id))]

    // 不可变更新：从稳定快照构造目标画板的新数组，不修改 store 里取出的对象。
    boardStore.saveBoardData(boardId, { nodes: nextTargetNodes, edges: nextTargetEdges })
    // boardData 不在 store 订阅里自动落盘：目标画板不在前台时也要显式排一次快照写入，
    // 否则移动到别的画板的卡片要等下次切到那块画板才可能写盘。
    getActiveSyncEngine()?.scheduleWriteBoard(boardId, {
      version: 2,
      nodes: nextTargetNodes,
      edges: nextTargetEdges,
      viewport: targetData.viewport ?? DEFAULT_BOARD_VIEWPORT,
    })

    setNodes((nds) => nds.filter((n) => n.id !== cardId))
    setEdges(remainingEdges)
  }, [cardId, getEdges, getNode, setEdges, setNodes])

  return {
    handleToggleCollapse,
    handleColorChange,
    handleRemoveFromBoard,
    handleMoveToBoard,
  }
}
