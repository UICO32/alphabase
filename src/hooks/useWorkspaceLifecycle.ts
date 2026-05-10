import { useEffect, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useCardStore } from '../utils/cardStore'

interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
}

export function useWorkspaceLifecycle({ setNodes, setEdges }: UseWorkspaceLifecycleOptions) {
  const initialized = useRef(false)
  const addCard = useCardStore((s) => s.addCard)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // 添加测试数据
    const demoCards = [
      {
        id: 'card-1',
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"欢迎使用 Heptabase Canvas"}]}]',
        color: 'blue' as const,
        variant: 'solid' as const,
        createdAt: Date.now(),
        title: '欢迎卡片',
        previewHTML: '<h2>欢迎使用 Heptabase Canvas</h2><p>这是一个基于 React Flow 的画布知识管理应用。</p>',
      },
      {
        id: 'card-2',
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"功能特性"}]}]',
        color: 'green' as const,
        variant: 'glass' as const,
        createdAt: Date.now() - 1000,
        title: '功能特性',
        previewHTML: '<h2>功能特性</h2><ul><li>拖拽卡片</li><li>创建连接</li><li>分区管理</li></ul>',
      },
      {
        id: 'card-3',
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"快速开始"}]}]',
        color: 'yellow' as const,
        variant: 'outline' as const,
        createdAt: Date.now() - 2000,
        title: '快速开始',
        previewHTML: '<h2>快速开始</h2><p>点击卡片进入编辑模式，拖拽空白处移动画布。</p>',
      },
    ]

    demoCards.forEach((card) => addCard(card))

    const demoNodes: Node[] = [
      {
        id: 'card-1',
        type: 'card',
        position: { x: 100, y: 100 },
        data: {
          cardId: 'card-1',
          color: 'blue',
          variant: 'solid',
          width: 280,
          height: 200,
        },
      },
      {
        id: 'card-2',
        type: 'card',
        position: { x: 500, y: 150 },
        data: {
          cardId: 'card-2',
          color: 'green',
          variant: 'glass',
          width: 280,
          height: 200,
        },
      },
      {
        id: 'card-3',
        type: 'card',
        position: { x: 300, y: 400 },
        data: {
          cardId: 'card-3',
          color: 'yellow',
          variant: 'outline',
          width: 280,
          height: 200,
        },
      },
    ]

    const demoEdges: Edge[] = [
      {
        id: 'edge-1-2',
        source: 'card-1',
        target: 'card-2',
        type: 'connection',
      },
      {
        id: 'edge-2-3',
        source: 'card-2',
        target: 'card-3',
        type: 'connection',
      },
    ]

    setNodes(demoNodes)
    setEdges(demoEdges)

    console.log('Workspace lifecycle initialized with demo data')
  }, [setNodes, setEdges, addCard])
}
