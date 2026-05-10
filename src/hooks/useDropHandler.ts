import { useCallback } from 'react'
import { type Node } from '@xyflow/react'
import { useCardStore } from '../utils/cardStore'

interface UseDropHandlerOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

export function useDropHandler({ nodes, setNodes }: UseDropHandlerOptions) {
  const addCard = useCardStore((s) => s.addCard)

  const handleDrop = useCallback((event: React.DragEvent) => {
    // TODO: 实现拖拽处理
    // 1. 检测是否从卡片库拖拽
    // 2. 获取放置位置坐标
    // 3. 创建新卡片节点
    console.log('Drop event:', event)
  }, [nodes, setNodes, addCard])

  return { handleDrop }
}
