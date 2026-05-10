import { useEffect, useRef } from 'react'

type BlockNoteEditor = {
  document: Array<{ id: string; type: string; props?: Record<string, unknown>; children?: unknown[] }>
  getBlock(id: string): { id: string; type: string; props?: Record<string, unknown>; children?: unknown[] } | undefined
  insertBlocks(blocks: unknown[], ref: unknown, placement: 'before' | 'after'): unknown[]
  removeBlocks(blocks: unknown[]): void
  replaceBlocks(toRemove: unknown[], toInsert: unknown[]): void
}

function findBlockIdFromDom(el: HTMLElement | null): string | null {
  while (el) {
    const id = el.getAttribute?.('data-id')
    if (id) return id
    el = el.parentElement
  }
  return null
}

function isImageBlock(block: { type: string } | undefined): boolean {
  return block?.type === 'image'
}

export function useImageColumnDrop(
  containerRef: React.RefObject<HTMLDivElement | null>,
  editor: BlockNoteEditor | null,
  editable: boolean,
) {
  const dragOverBlockRef = useRef<{ id: string; side: 'left' | 'right' } | null>(null)
  const indicatorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !editor || !editable) return

    const showIndicator = (imgEl: HTMLElement, side: 'left' | 'right') => {
      removeIndicator()
      const rect = imgEl.getBoundingClientRect()
      const containerRect = el.getBoundingClientRect()
      const div = document.createElement('div')
      div.className = 'image-column-drop-indicator'
      div.style.cssText = `
        position: absolute;
        top: ${rect.top - containerRect.top}px;
        ${side === 'left' ? `left: ${rect.left - containerRect.left - 2}px` : `left: ${rect.right - containerRect.left}px`};
        width: 3px;
        height: ${rect.height}px;
        background: #3b82f6;
        border-radius: 2px;
        pointer-events: none;
        z-index: 100;
        transition: opacity 0.1s;
      `
      el.appendChild(div)
      indicatorRef.current = div
    }

    const removeIndicator = () => {
      indicatorRef.current?.remove()
      indicatorRef.current = null
    }

    const handleDragOver = (e: DragEvent) => {
      const target = e.target as HTMLElement
      const imgWrapper = target.closest('[data-content-type="image"]') as HTMLElement | null
      if (!imgWrapper) {
        dragOverBlockRef.current = null
        removeIndicator()
        return
      }

      const blockId = findBlockIdFromDom(imgWrapper)
      if (!blockId) return

      const block = editor.getBlock(blockId)
      if (!block || !isImageBlock(block)) return

      const rect = imgWrapper.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      const side = e.clientX < midX ? 'left' : 'right'

      dragOverBlockRef.current = { id: blockId, side }
      showIndicator(imgWrapper, side)
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      const dropTarget = dragOverBlockRef.current
      removeIndicator()
      dragOverBlockRef.current = null

      if (!dropTarget) return

      const dragData = e.dataTransfer?.getData('text/plain') || ''
      const draggedEl = el.querySelector('.bn-block-outer[data-is-dragging="true"]')
      const draggedBlockId = draggedEl ? findBlockIdFromDom(draggedEl as HTMLElement) : null

      if (!draggedBlockId && !dragData) return

      const sourceId = draggedBlockId
      if (!sourceId || sourceId === dropTarget.id) return

      const sourceBlock = editor.getBlock(sourceId)
      const targetBlock = editor.getBlock(dropTarget.id)
      if (!sourceBlock || !targetBlock) return
      if (!isImageBlock(sourceBlock)) return

      e.preventDefault()
      e.stopPropagation()

      const leftBlock = dropTarget.side === 'left' ? sourceBlock : targetBlock
      const rightBlock = dropTarget.side === 'left' ? targetBlock : sourceBlock

      const columnListBlock = {
        type: 'columnList' as const,
        children: [
          {
            type: 'column' as const,
            children: [{ type: 'image' as const, props: { ...leftBlock.props } }],
          },
          {
            type: 'column' as const,
            children: [{ type: 'image' as const, props: { ...rightBlock.props } }],
          },
        ],
      }

      try {
        editor.replaceBlocks([targetBlock, sourceBlock], [columnListBlock])
      } catch {
        try {
          editor.replaceBlocks([targetBlock], [columnListBlock])
          editor.removeBlocks([sourceBlock])
        } catch {
          // If column creation fails, let the default drop behavior handle it
        }
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      const related = e.relatedTarget as HTMLElement | null
      if (related && el.contains(related)) return
      dragOverBlockRef.current = null
      removeIndicator()
    }

    const handleDragEnd = () => {
      dragOverBlockRef.current = null
      removeIndicator()
    }

    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('drop', handleDrop, true)
    el.addEventListener('dragleave', handleDragLeave)
    el.addEventListener('dragend', handleDragEnd)

    return () => {
      el.removeEventListener('dragover', handleDragOver)
      el.removeEventListener('drop', handleDrop, true)
      el.removeEventListener('dragleave', handleDragLeave)
      el.removeEventListener('dragend', handleDragEnd)
      removeIndicator()
    }
  }, [containerRef, editor, editable])
}
