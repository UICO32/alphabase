import { useEffect } from 'react'
import { type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import type { MediaNodeData } from '../components/canvas/MediaNode'
import { fileToDataUrl, generateId } from '../utils/fileUtils'

interface UseCanvasPasteOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>
}

function makeMediaNode(url: string, position: { x: number; y: number }): Node<MediaNodeData> {
  return {
    id: generateId('media'),
    type: 'media',
    position,
    data: { url, type: 'image' },
    width: 100,
    height: 100,
  }
}

export function useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef }: UseCanvasPasteOptions) {
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.ProseMirror, .bn-editor, .card-blocknote-editor, input, textarea, [contenteditable]')) return

      const items = e.clipboardData?.items
      if (!items) return

      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'))
      if (!imageItem) return

      e.preventDefault()
      e.stopPropagation()

      const file = imageItem.getAsFile()
      if (!file) return

      const instance = reactFlowInstance.current
      if (!instance) return

      const url = await fileToDataUrl(file)

      const pos = lastMousePosRef.current
        ? instance.screenToFlowPosition(lastMousePosRef.current)
        : instance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

      setNodes((nds) => [...nds, makeMediaNode(url, pos)])
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [reactFlowInstance, setNodes, lastMousePosRef])
}
