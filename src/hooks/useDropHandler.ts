import { useCallback } from 'react'
import { type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import type { MediaNodeData } from '../types/card'
import type { CardNodeData } from '../types/card'
import { useCardStore } from '../stores/cardStore'
import { fileToDataUrl, generateId, isImageFile } from '../utils/fileUtils'

interface UseDropHandlerOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

interface CardDragData {
  type: 'card'
  cardId: string
  isNewInstance: boolean
  dragOffset?: { x: number; y: number }
}

export function useDropHandler({ reactFlowInstance, setNodes }: UseDropHandlerOptions) {
  const handleDragOver = useCallback((event: React.DragEvent) => {
    // 编辑器内的拖拽不应被画布拦截
    const target = event.target as HTMLElement
    if (target?.closest?.('.card-blocknote-editor, .ProseMirror, .bn-editor')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      // 编辑器内的 drop 由 Prosemirror 处理，画布不应拦截
      const target = event.target as HTMLElement
      if (target?.closest?.('.card-blocknote-editor, .ProseMirror, .bn-editor')) return

      const instance = reactFlowInstance.current
      if (!instance) return

      event.preventDefault()

      const position = instance.screenToFlowPosition({ x: event.clientX, y: event.clientY })

      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter(isImageFile)
        if (imageFiles.length > 0) {
          imageFiles.forEach((file, i) => {
            fileToDataUrl(file).then((url) => {
              const node: Node<MediaNodeData> = {
                id: generateId('media'),
                type: 'media',
                position: { x: position.x + i * 40, y: position.y + i * 40 },
                data: { url, type: 'image' },
                // 合理默认尺寸：避免 100x100 的小占位在加载完成前被放大显示（模糊），
                // 加载完成后 MediaNode 会用图片自然尺寸更新节点
                width: 320,
                height: 220,
              }
              setNodes((nds) => [...nds, node])
            })
          })
          return
        }
      }

      const jsonData = event.dataTransfer?.getData('application/json')
      if (jsonData) {
        try {
          const dragData: CardDragData = JSON.parse(jsonData)
          if (dragData.type === 'card') {
            const card = useCardStore.getState().cards[dragData.cardId]
            if (card) {
              let cardId = dragData.cardId
              if (dragData.isNewInstance) {
                const newCard = { ...card, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }
                useCardStore.getState().addCard(newCard)
                cardId = newCard.id
              }
              const dropOffset = dragData.dragOffset ?? { x: 0, y: 0 }
              const dropPosition = instance.screenToFlowPosition({
                x: event.clientX - dropOffset.x,
                y: event.clientY - dropOffset.y,
              })
              const node: Node<CardNodeData> = {
                id: cardId,
                type: 'card',
                position: dropPosition,
                data: {
                  cardId,
                  color: card.color,
                  collapsed: card.collapsed,
                  fixedHeight: card.fixedHeight,
                },
                className: 'card-node-landing',
              }
              setNodes((nds) => [...nds, node])
            }
          }
        } catch {
          // ignore malformed JSON
        }
      }
    },
    [reactFlowInstance, setNodes],
  )

  return { handleDragOver, handleDrop }
}
