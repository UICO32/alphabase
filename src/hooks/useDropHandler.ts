import { useCallback } from 'react'
import { type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import type { MediaNodeData } from '../types/card'
import type { CardNodeData } from '../types/card'
import { useCardStore } from '../stores/cardStore'
import { fileToDataUrl, generateId } from '../utils/fileUtils'

interface UseDropHandlerOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

function isImageFile(file: File) {
  if (file.type.toLowerCase().startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i.test(file.name)
}

interface CardDragData {
  type: 'card'
  cardId: string
  isNewInstance: boolean
}

export function useDropHandler({ reactFlowInstance, setNodes }: UseDropHandlerOptions) {
  const handleDragOver = useCallback((event: React.DragEvent) => {
    // 编辑器内的拖拽（BlockNote DragHandle）不应被画布拦截
    const target = event.target as HTMLElement
    if (target?.closest?.('.card-blocknote-editor, .ProseMirror, .bn-editor')) return
    // BlockNote 块拖拽设置 effectAllowed='move' 和 blocknote/html，
    // 若画布设置 dropEffect='copy' 会与 effectAllowed 冲突导致禁止图标
    if (event.dataTransfer?.types?.includes('blocknote/html')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      // 编辑器内的 drop 由 Prosemirror 处理，画布不应拦截
      const target = event.target as HTMLElement
      if (target?.closest?.('.card-blocknote-editor, .ProseMirror, .bn-editor')) return
      // BlockNote 块拖拽不应被画布处理
      if (event.dataTransfer?.types?.includes('blocknote/html')) return

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
                width: 100,
                height: 100,
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
              const node: Node<CardNodeData> = {
                id: cardId,
                type: 'card',
                position,
                data: {
                  cardId,
                  color: card.color,
                  collapsed: card.collapsed,
                  fixedHeight: card.fixedHeight,
                },
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
