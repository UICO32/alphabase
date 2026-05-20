import { useCallback } from 'react'
import { type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import type { MediaNodeData } from '../components/canvas/MediaNode'
import type { CardNodeData } from '../components/canvas/CardNode'
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
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
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
