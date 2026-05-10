import { useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useCardStore } from '../utils/cardStore'

interface UseCanvasDoubleClickOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
}

export function useCanvasDoubleClick({ nodes, setNodes }: UseCanvasDoubleClickOptions) {
  const addCard = useCardStore((s) => s.addCard)

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    // TODO: 实现双击创建卡片
    // 1. 获取点击位置的画布坐标
    // 2. 创建新卡片
    // 3. 添加新节点到 nodes
    console.log('Double click at:', event.clientX, event.clientY)
  }, [nodes, setNodes, addCard])

  return { handleDoubleClick }
}
