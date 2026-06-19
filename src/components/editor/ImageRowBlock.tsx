import { useState, useCallback, useRef, useEffect } from 'react'
import type { FC } from 'react'
import type { BlockNoteEditor } from '@blocknote/core'
import { isImageFile } from '../../utils/fileUtils'
import { readClipboardImageFiles } from '../../converters/richTextUtils'

interface ImageRowBlockProps {
  urls: string[]
  captions: string[]
  editor: BlockNoteEditor<any, any, any>
  blockId: string
  editable: boolean
  onUpdate: (urls: string[], captions: string[]) => void
}

export const ImageRowBlock: FC<ImageRowBlockProps> = ({
  urls,
  captions,
  editable,
  onUpdate,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const addImageFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(isImageFile)
    if (imageFiles.length === 0) return

    const { fileToDataUrl } = await import('../../converters/richTextUtils')
    const newUrls: string[] = []
    for (const file of imageFiles) {
      newUrls.push(await fileToDataUrl(file))
    }

    const totalUrls = [...urls, ...newUrls].slice(0, 4)
    const totalCaptions = [...captions, ...newUrls.map(() => '')].slice(0, 4)
    onUpdate(totalUrls, totalCaptions)
  }, [urls, captions, onUpdate])

  const handleRemoveImage = useCallback((index: number) => {
    const newUrls = urls.filter((_, i) => i !== index)
    const newCaptions = captions.filter((_, i) => i !== index)
    onUpdate(newUrls, newCaptions)
  }, [urls, captions, onUpdate])

  // Monitor paste events on the container
  useEffect(() => {
    if (!editable) return
    const el = containerRef.current
    if (!el) return

    const handlePaste = async (e: ClipboardEvent) => {
      if (!el.contains(document.activeElement) && document.activeElement !== el) return
      if (urls.length >= 4) return

      const files: File[] = []
      if (e.clipboardData) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) files.push(file)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        await addImageFiles(files)
        setActiveSlot(null)
        return
      }

      const clipboardFiles = await readClipboardImageFiles()
      if (clipboardFiles.length > 0) {
        e.preventDefault()
        await addImageFiles(clipboardFiles)
        setActiveSlot(null)
      }
    }

    el.addEventListener('paste', handlePaste, true)
    return () => el.removeEventListener('paste', handlePaste, true)
  }, [editable, urls.length, addImageFiles])

  // Handle click on empty slot — focus container to receive paste, show active state
  const handleSlotClick = useCallback((slotIndex: number) => {
    const el = containerRef.current
    if (el) el.focus()
    setActiveSlot(slotIndex)
  }, [])

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null
    if (related && containerRef.current?.contains(related)) return
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files || []).filter(isImageFile)
    if (files.length > 0) await addImageFiles(files)
  }, [addImageFiles])

  const totalSlots = Math.max(urls.length, 2)
  const emptySlots = totalSlots - urls.length

  return (
    <div
      ref={containerRef}
      tabIndex={editable ? 0 : undefined}
      style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '4px 0', position: 'relative', outline: 'none' }}
      onDragOver={editable ? handleDragOver : undefined}
      onDragLeave={editable ? handleDragLeave : undefined}
      onDrop={editable ? handleDrop : undefined}
    >
      {urls.map((url, index) => (
        <div
          key={index}
          style={{ flex: 1, minWidth: 0, position: 'relative' }}
          onMouseEnter={() => editable && setHoverIndex(index)}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <img
            src={url}
            alt=""
            style={{ width: '100%', height: 'auto', borderRadius: '6px', display: 'block' }}
          />
          {editable && hoverIndex === index && urls.length > 1 && (
            <button
              onClick={() => handleRemoveImage(index)}
              style={{
                position: 'absolute', top: '4px', right: '4px',
                width: '20px', height: '20px', borderRadius: '50%',
                border: 'none', background: 'rgba(0,0,0,0.6)', color: 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '12px',
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {editable && emptySlots > 0 && Array.from({ length: Math.min(emptySlots, 4 - urls.length) }).map((_, i) => {
        const slotIndex = urls.length + i
        const isActive = activeSlot === slotIndex
        return (
          <div
            key={`empty-${i}`}
            onClick={() => handleSlotClick(slotIndex)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: '80px',
              border: isActive
                ? '2px solid var(--line-active, #3b82f6)'
                : dragOver
                  ? '2px solid var(--line-active, #3b82f6)'
                  : '1px dashed var(--line-default)',
              borderRadius: '6px',
              background: isActive
                ? 'rgba(59,130,246,0.06)'
                : dragOver
                  ? 'rgba(59,130,246,0.06)'
                  : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <span style={{ color: 'var(--fg-tertiary)', fontSize: '12px' }}>
              {isActive ? '按 Ctrl+V 粘贴图片' : dragOver ? '释放以添加' : '点击后粘贴图片'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
