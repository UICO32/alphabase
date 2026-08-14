import { useEffect } from 'react'
import { type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import { storeMediaFileForWorkspace } from '../media/imagePipeline'
import { createMediaNode } from '../media/createMediaNode'
import { showToast } from '../utils/toast'

interface UseCanvasPasteOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>
}

export function useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef }: UseCanvasPasteOptions) {
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (e.defaultPrevented) return

      const target = e.target as HTMLElement
      if (target.closest('.ProseMirror, .bn-editor, .card-blocknote-editor, input, textarea, [contenteditable]')) return

      const activeEl = document.activeElement
      if (activeEl && activeEl.closest('.ProseMirror, .bn-editor, .card-blocknote-editor, [contenteditable]')) return

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

      try {
        const workspacePath = localStorage.getItem('hepta-last-workspace-path')
        const asset = await storeMediaFileForWorkspace(workspacePath, file)

        const pos = lastMousePosRef.current
          ? instance.screenToFlowPosition(lastMousePosRef.current)
          : instance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

        setNodes((nds) => [...nds, createMediaNode(asset, pos)])
      } catch (error) {
        showToast(error instanceof Error ? error.message : '无法导入剪贴板图片')
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [reactFlowInstance, setNodes, lastMousePosRef])
}
