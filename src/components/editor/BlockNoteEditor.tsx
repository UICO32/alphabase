import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, type ForwardedRef } from 'react'
import { dropCursor } from '@tiptap/pm/dropcursor'
import { useCreateBlockNote, SideMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { ImageToolbar } from './ImageToolbar'
import { useImageColumnDrop } from './useImageColumnDrop'
import { DragOnlySideMenu } from './DragOnlySideMenu'

export interface BlockNoteEditorHandle {
  focus: () => void
  blur: () => void
  setEditable: (editable: boolean) => void
  focusAtCoords: (point: { x: number; y: number }) => void
}

export interface BlockNoteEditorProps {
  content: string
  onChange: (content: string) => void
  onFocus?: () => void
  onBlur?: () => void
  theme?: 'light' | 'dark'
  editable?: boolean
  showSideMenu?: boolean
  enforceInitialHeading?: boolean
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as data URL'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function isImageFile(file: File) {
  if (file.type.toLowerCase().startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i.test(file.name)
}

function isReadableImageUrl(url: string) {
  return url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')
}

async function readClipboardImageFiles() {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.read !== 'function') {
    return []
  }

  try {
    const clipboardItems = await navigator.clipboard.read()
    const files: File[] = []

    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (!type.startsWith('image/')) continue
        const blob = await item.getType(type)
        const extension = type.split('/')[1] || 'png'
        files.push(new File([blob], `pasted-image.${extension}`, { type: blob.type || type }))
      }
    }

    return files
  } catch (error) {
    console.warn('Could not read image from clipboard API:', error)
    return []
  }
}

const SAVE_DEBOUNCE_MS = 400

function parseContentToBlocks(content: string): unknown[] | undefined {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    const text = content.trim()
    if (text) {
      return [{ type: 'paragraph', content: [{ type: 'text', text }] }]
    }
  }
  return undefined
}

function toComparableJson(value: unknown) {
  return JSON.stringify(value, (key, current) => {
    if (key === 'id') return undefined
    return current
  })
}

const CardBlockNoteEditorInner = (
  { content, onChange, onFocus, onBlur, theme = 'light', editable = true, showSideMenu = false, enforceInitialHeading = false }: BlockNoteEditorProps,
  ref: ForwardedRef<BlockNoteEditorHandle>
) => {
    const initialContent = useRef<unknown[] | undefined>(undefined)
    const isFirstRender = useRef(true)
    const containerRef = useRef<HTMLDivElement>(null)
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    if (isFirstRender.current) {
      initialContent.current = parseContentToBlocks(content)
      isFirstRender.current = false
    }

    const uploadFile = useCallback(async (file: File) => {
      if (file.type && !isImageFile(file)) {
        throw new Error('Only image paste is supported inside cards for now.')
      }
      return await fileToDataUrl(file)
    }, [])

    const editor = useCreateBlockNote({
      initialContent: initialContent.current as Parameters<typeof useCreateBlockNote>[0] extends { initialContent?: infer T } ? T : never,
      uploadFile,
      // 使用原生 prosemirror dropCursor，显示块级别的蓝色插入线
      dropCursor: () => dropCursor({
        color: '#3b82f6',
        width: 3,
      }),
      pasteHandler: ({ event, defaultPasteHandler }) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        const fallbackPaste = () => defaultPasteHandler({
          prioritizeMarkdownOverHTML: false,
          plainTextAsMarkdown: false,
        })

        const insertImages = async (files: File[]) => {
          const imageUrls: string[] = []

          for (const file of files) {
            imageUrls.push(await fileToDataUrl(file))
          }

          if (imageUrls.length === 0) {
            fallbackPaste()
            return
          }

          const imageBlocks = imageUrls.map((url) => ({
            type: 'image' as const,
            props: { url },
          }))

          let anchorBlock = editor.document[editor.document.length - 1]
          try {
            anchorBlock = editor.getTextCursorPosition().block ?? anchorBlock
          } catch {
            // Fall back to the last document block when there is no text cursor yet.
          }

          if (!anchorBlock) {
            fallbackPaste()
            return
          }

          const insertedBlocks = editor.insertBlocks(imageBlocks, anchorBlock, 'after')
          const lastInsertedBlock = insertedBlocks[insertedBlocks.length - 1]
          if (!lastInsertedBlock) return

          const [paragraph] = editor.insertBlocks([{ type: 'paragraph' }], lastInsertedBlock, 'after')
          if (paragraph) editor.setTextCursorPosition(paragraph, 'start')
        }

        const clipboardItemTypes = Array.from(clipboardData.items).map((item) => item.type)
        const hasImageFileItem = Array.from(clipboardData.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'))
          || Array.from(clipboardData.files).some((file) => isImageFile(file))

        console.debug('[card paste]', {
          itemTypes: clipboardItemTypes,
          fileCount: clipboardData.files.length,
        })

        if (hasImageFileItem) {
          console.debug('[card paste] use default image file paste')
          return fallbackPaste()
        }

        const html = clipboardData.getData('text/html')
        if (!html) {
          return fallbackPaste()
        }

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const imageUrls = Array.from(doc.querySelectorAll('img'))
          .map((img) => img.getAttribute('src')?.trim())
          .filter((src): src is string => Boolean(src))

        if (imageUrls.length === 0) {
          return fallbackPaste()
        }

        const hasOnlyImages = !!doc.body.children.length && Array.from(doc.body.children).every((node) => node.tagName.toLowerCase() === 'img')
        const hasUnreadableImages = imageUrls.some((url) => !isReadableImageUrl(url))

        if (!hasUnreadableImages || !hasOnlyImages) {
          console.debug('[card paste] use default html paste')
          return fallbackPaste()
        }

        console.debug('[card paste] try clipboard.read fallback for local image html')
        void readClipboardImageFiles()
          .then((files) => {
            if (files.length === 0) {
              console.warn('[card paste] clipboard.read returned no image files, fallback to default paste')
              fallbackPaste()
              return
            }
            return insertImages(files)
          })
          .catch((error) => {
            console.warn('[card paste] clipboard.read fallback failed, use default paste', error)
            fallbackPaste()
          })

        return true
      },
    })

    useImperativeHandle(ref, () => ({
      focus: () => {
        editor.focus()
      },
      blur: () => {
        (editor as { blur?: () => void }).blur?.()
      },
      setEditable: (nextEditable: boolean) => {
        editor.isEditable = nextEditable
      },
      focusAtCoords: ({ x, y }: { x: number; y: number }) => {
        editor.isEditable = true
        requestAnimationFrame(() => {
          const pm = (editor as unknown as Record<string, unknown>).prosemirrorView as {
            posAtCoords: (p: { left: number; top: number }) => { pos: number } | null
            state: { doc: { resolve: (pos: number) => { pos: number } }; tr: { setSelection: (sel: unknown) => unknown } }
            dispatch: (tr: unknown) => void
            focus: () => void
          } | undefined
          if (!pm) return
          const pos = pm.posAtCoords({ left: x, top: y })?.pos
          if (pos != null) {
            const resolvedPos = pm.state.doc.resolve(pos)
            const { TextSelection } = require('@tiptap/pm/state')
            const selection = TextSelection.near(resolvedPos)
            pm.dispatch(pm.state.tr.setSelection(selection))
          }
          pm.focus()
        })
      },
    }))

    const flushPending = useCallback(() => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
        onChangeRef.current(JSON.stringify(editor.document))
      }
    }, [editor])

    const handleChange = useCallback(() => {
      if (pendingTimerRef.current !== null) clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null
        onChangeRef.current(JSON.stringify(editor.document))
      }, SAVE_DEBOUNCE_MS)
    }, [editor])

    useEffect(() => {
      const unsub = editor.onChange(handleChange)
      return () => {
        unsub?.()
        if (pendingTimerRef.current !== null) {
          clearTimeout(pendingTimerRef.current)
          onChangeRef.current(JSON.stringify(editor.document))
          pendingTimerRef.current = null
        }
      }
    }, [editor, handleChange])

    useEffect(() => {
      editor.isEditable = editable
    }, [editor, editable])

    useEffect(() => {
      const nextBlocks = parseContentToBlocks(content)
      const currentComparable = toComparableJson(editor.document)
      const nextComparable = toComparableJson(nextBlocks ?? [])

      if (currentComparable === nextComparable) return
      if (editable && editor.isFocused()) return

      const currentIds = editor.document.map((block) => block.id)
      const replacement = nextBlocks && nextBlocks.length > 0
        ? nextBlocks
        : [{ type: 'paragraph' }]

      if (currentIds.length > 0) {
        editor.replaceBlocks(currentIds, replacement as any)
      }
    }, [content, editor, editable])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const handleFocusIn = () => onFocus?.()
      const handleFocusOut = (e: FocusEvent) => {
        if (!el.contains(e.relatedTarget as Node)) {
          flushPending()
          onBlur?.()
        }
      }
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!enforceInitialHeading) return
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
        requestAnimationFrame(() => {
          const cursor = editor.getTextCursorPosition()
          const firstBlock = editor.document[0]
          if (!firstBlock || !cursor.prevBlock || cursor.prevBlock.id !== firstBlock.id) return
          if (cursor.block.id === firstBlock.id) return
          if (cursor.block.type !== 'heading') return
          editor.updateBlock(cursor.block, { type: 'paragraph' })
        })
      }
      // 防止拖拽后自动选中文本
      const handleDrop = () => {
        setTimeout(() => {
          const selection = window.getSelection()
          if (selection && selection.type === 'Range') {
            selection.removeAllRanges()
          }
        }, 0)
      }
      el.addEventListener('focusin', handleFocusIn)
      el.addEventListener('focusout', handleFocusOut)
      el.addEventListener('keydown', handleKeyDown)
      el.addEventListener('drop', handleDrop)
      return () => {
        el.removeEventListener('focusin', handleFocusIn)
        el.removeEventListener('focusout', handleFocusOut)
        el.removeEventListener('keydown', handleKeyDown)
        el.removeEventListener('drop', handleDrop)
      }
    }, [editor, enforceInitialHeading, onFocus, onBlur, flushPending])

    useImageColumnDrop(containerRef, editor as any, editable)

    return (
      <div ref={containerRef} style={{ position: 'relative' }} className={`card-blocknote-editor card-blocknote-editor--${theme} ${editable ? 'card-blocknote-editor--editable' : 'card-blocknote-editor--readonly'}`}>
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme={theme}
          slashMenu={editable}
          style={{ fontSize: '13px' }}
        >
          {showSideMenu && editable && (
            <SideMenuController
              sideMenu={DragOnlySideMenu}
              floatingOptions={{
                placement: 'left-start',
              }}
            />
          )}
        </BlockNoteView>
        {editable && <ImageToolbar containerRef={containerRef} editable={editable} theme={theme} />}
      </div>
    )
  }

export const CardBlockNoteEditor = forwardRef<BlockNoteEditorHandle, BlockNoteEditorProps>(CardBlockNoteEditorInner)

function extractText(value: unknown, parts: string[]) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) parts.push(trimmed)
    return
  }
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) extractText(item, parts)
    return
  }
  const record = value as Record<string, unknown>
  if (record.type === 'image') parts.push('[Image]')
  if (typeof record.text === 'string') {
    const text = record.text.trim()
    if (text) parts.push(text)
  }
  if (typeof record.caption === 'string') {
    const caption = record.caption.trim()
    if (caption) parts.push(caption)
  }
  if (typeof record.name === 'string') {
    const name = record.name.trim()
    if (name) parts.push(name)
  }
  if ('content' in record) extractText(record.content, parts)
  if ('children' in record) extractText(record.children, parts)
}

export function summarizeRichTextPreview(content: string) {
  const parts: string[] = []
  try {
    extractText(JSON.parse(content), parts)
  } catch {
    if (content.trim()) parts.push(content.trim())
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

