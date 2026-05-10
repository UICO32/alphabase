import { useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useCardStore } from '../utils/cardStore'

interface UseCanvasPasteOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
}

export function useCanvasPaste({ nodes, setNodes, setEdges }: UseCanvasPasteOptions) {
  const addCard = useCardStore((s) => s.addCard)

  const handlePaste = useCallback((event: ClipboardEvent) => {
    // TODO: 实现粘贴处理
    // 1. 检测是否粘贴卡片内容
    // 2. 创建新卡片节点
    // 3. 添加到画布
    console.log('Paste event:', event)
  }, [nodes, setNodes, setEdges, addCard])

  return { handlePaste }
}
