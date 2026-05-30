import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, type ForwardedRef } from 'react'
import { dropCursor } from '@tiptap/pm/dropcursor'
import { TextSelection, EditorState } from '@tiptap/pm/state'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { undoDepth, redoDepth } from 'prosemirror-history'
import { useCreateBlockNote, SideMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import type { PartialBlock } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { ImageToolbar } from './ImageToolbar'
import { CardFormattingToolbar } from './CardFormattingToolbar'
import { CardSlashMenu } from './CardSlashMenu'
import { useImageColumnDrop } from './useImageColumnDrop'
import { DragOnlySideMenu } from './DragOnlySideMenu'
import { usePosAtCoordsScalePatch } from './usePosAtCoordsScalePatch'
import {
  fileToDataUrl,
  isImageFile,
  isReadableImageUrl,
  readClipboardImageFiles,
  parseContentToBlocks,
  toComparableJson,
  SAVE_DEBOUNCE_MS
} from '../../converters/richTextUtils'

export interface BlockNoteEditorHandle {
  focus: () => void
  blur: () => void
  setEditable: (editable: boolean) => void
  focusAtCoords: (point: { x: number; y: number }) => void
  canUndo: () => boolean
  canRedo: () => boolean
  setContent: (contentJson: string) => void
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
  onDragBlocksOutside?: (blocks: unknown[]) => void
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
    const selectAllStepRef = useRef(0)

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
        color: 'var(--border-active, #3b82f6)',
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

        const hasImageFileItem = Array.from(clipboardData.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'))
          || Array.from(clipboardData.files).some((file) => isImageFile(file))

        if (hasImageFileItem) {
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
          return fallbackPaste()
        }

        void readClipboardImageFiles()
          .then((files) => {
            if (files.length === 0) {
              fallbackPaste()
              return
            }
            return insertImages(files)
          })
          .catch(() => {
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
          requestAnimationFrame(() => {
            const pm = (editor as unknown as Record<string, unknown>).prosemirrorView as {
              posAtCoords: (p: { left: number; top: number }) => { pos: number } | null
              posAtDOM: (node: Node, offset: number) => number
              state: { doc: { resolve: (pos: number) => any }; tr: { setSelection: (sel: unknown) => unknown } }
              dispatch: (tr: unknown) => void
              focus: () => void
              dom: HTMLElement
            } | undefined
            if (!pm) return

            let pos: number | null = null

            // Use browser caret APIs to get a precise cursor position from the
            // click coordinates. This avoids the block-boundary issue where
            // posAtCoords always resolves to the start of the content block.
            try {
              const range = (document as any).caretPositionFromPoint?.(x, y)
                ?? (document as any).caretRangeFromPoint?.(x, y)
              if (range) {
                const node = range.offsetNode ?? range.startContainer
                const offset = range.offset ?? range.startOffset
                if (node && pm.dom.contains(node)) {
                  pos = pm.posAtDOM(node, offset)
                }
              }
            } catch { /* fall through to posAtCoords */ }

            if (pos == null) {
              const result = pm.posAtCoords({ left: x, top: y })
              if (result?.pos != null) pos = result.pos
            }

            if (pos != null) {
              const resolvedPos = pm.state.doc.resolve(pos)
              const selection = TextSelection.near(resolvedPos)
              pm.dispatch(pm.state.tr.setSelection(selection))
            }
            pm.focus()
            setTimeout(() => pm.focus(), 50)
          })
        })
      },
      canUndo: () => {
        const pm = (editor as unknown as Record<string, unknown>).prosemirrorView as { state: EditorState } | undefined
        if (!pm) return false
        return undoDepth(pm.state) > 0
      },
      canRedo: () => {
        const pm = (editor as unknown as Record<string, unknown>).prosemirrorView as { state: EditorState } | undefined
        if (!pm) return false
        return redoDepth(pm.state) > 0
      },
      setContent: (contentJson: string) => {
        const nextBlocks = parseContentToBlocks(contentJson)
        const replacement = nextBlocks && nextBlocks.length > 0
          ? nextBlocks
          : [{ type: 'paragraph' }]
        const currentIds = editor.document.map((block) => block.id)
        if (currentIds.length > 0) {
          editor.replaceBlocks(currentIds, replacement as PartialBlock[])
        }
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
        editor.replaceBlocks(currentIds, replacement as PartialBlock[])
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
    usePosAtCoordsScalePatch(editor)

    // 编辑器容器级别处理：块间隙/抓手/draggable 元素上方也需要 accept drop，否则浏览器显示禁止图标
    // 同时阻止拖拽进行中抓手元素触发二次 dragstart（"New drag was started while an existing drag is ongoing"）
    useEffect(() => {
      const el = containerRef.current
      if (!el || !editable) return
      const isBlockNoteDrag = (e: DragEvent) => e.dataTransfer?.types?.includes('blocknote/html')
      let dragActive = false
      const handleDragOver = (e: DragEvent) => {
        if (!isBlockNoteDrag(e) || e.defaultPrevented) return
        e.preventDefault()
        e.dataTransfer!.dropEffect = 'move'
      }
      const handleDragEnter = (e: DragEvent) => {
        if (!isBlockNoteDrag(e) || e.defaultPrevented) return
        e.preventDefault()
      }
      const handleDragStart = (e: DragEvent) => {
        if (!isBlockNoteDrag(e)) return
        if (dragActive) {
          e.preventDefault()
          return
        }
        dragActive = true
      }
      const handleDragEnd = () => {
        dragActive = false
      }
      window.addEventListener('dragover', handleDragOver, true)
      window.addEventListener('dragenter', handleDragEnter, true)
      window.addEventListener('dragstart', handleDragStart, true)
      window.addEventListener('dragend', handleDragEnd, true)
      return () => {
        window.removeEventListener('dragover', handleDragOver, true)
        window.removeEventListener('dragenter', handleDragEnter, true)
        window.removeEventListener('dragstart', handleDragStart, true)
        window.removeEventListener('dragend', handleDragEnd, true)
      }
    }, [editable])

    // Ctrl+A 两段式：第一次选中当前内容块，第二次选中所有内容块
    useEffect(() => {
      const el = containerRef.current
      if (!el || !editable) return

      const handleCtrlA = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey) || event.key !== 'a') return
        const target = event.target
        if (!(target instanceof Node) || !el.contains(target)) return

        const pmView = (editor as unknown as Record<string, unknown>).prosemirrorView as { state: { doc: ProseMirrorNode; selection: { $head: { pos: number }; from: number; to: number }; tr: { setSelection: (s: unknown) => unknown } }; dispatch: (tr: unknown) => void } | undefined
        if (!pmView) return
        const st = pmView.state

        // 计算光标所在的 textblock 范围
        const cursorPos = st.selection.$head.pos
        let currentBlockFrom = -1
        let currentBlockTo = -1
        st.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true
          const blockEnd = pos + node.nodeSize
          if (cursorPos > pos && cursorPos < blockEnd) {
            currentBlockFrom = pos + 1
            currentBlockTo = blockEnd - 1
            return false
          }
          return true
        })
        if (currentBlockFrom < 0) return

        // 计算全部 textblock 范围
        let allFrom = -1
        let allTo = -1
        st.doc.descendants((node, pos) => {
          if (node.isTextblock) {
            if (allFrom < 0) allFrom = pos + 1
            allTo = pos + node.nodeSize - 1
          }
          return true
        })
        if (allFrom < 0) return

        const isCurrentBlock = st.selection.from === currentBlockFrom && st.selection.to === currentBlockTo
        const isAllBlocks = st.selection.from === allFrom && st.selection.to === allTo

        // 如果只有一个 textblock 或者是第二次 Ctrl+A → 全选所有块
        if (selectAllStepRef.current === 1) {
          selectAllStepRef.current = 0
          event.preventDefault()
          event.stopImmediatePropagation()
          if (currentBlockFrom === allFrom && currentBlockTo === allTo) {
            // 只有一个块，第二次回退到选中当前块
            const sel = TextSelection.create(st.doc as unknown as Parameters<typeof TextSelection.create>[0], currentBlockFrom, currentBlockTo)
            pmView.dispatch(st.tr.setSelection(sel))
          } else if (!isAllBlocks) {
            const sel = TextSelection.create(st.doc as unknown as Parameters<typeof TextSelection.create>[0], allFrom, allTo)
            pmView.dispatch(st.tr.setSelection(sel))
          }
          return
        }

        // 第一次 Ctrl+A → 选中当前块
        selectAllStepRef.current = 1
        event.preventDefault()
        event.stopImmediatePropagation()
        if (!isCurrentBlock) {
          const sel = TextSelection.create(st.doc as unknown as Parameters<typeof TextSelection.create>[0], currentBlockFrom, currentBlockTo)
          pmView.dispatch(st.tr.setSelection(sel))
        }
      }

      // 用户做其他操作时复位 step
      const resetStep = () => { selectAllStepRef.current = 0 }
      const resetStepOnKey = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') return
        resetStep()
      }
      el.addEventListener('click', resetStep, true)
      el.addEventListener('keydown', resetStepOnKey, true)

      window.addEventListener('keydown', handleCtrlA, true)
      return () => {
        window.removeEventListener('keydown', handleCtrlA, true)
        el.removeEventListener('click', resetStep, true)
        el.removeEventListener('keydown', resetStepOnKey, true)
      }
    }, [editor, editable])

    return (
      <div ref={containerRef} spellCheck={false} style={{ position: 'relative', fontSize: '13px', lineHeight: '1.5' }} className={`card-blocknote-editor card-blocknote-editor--${theme} ${editable ? 'card-blocknote-editor--editable' : 'card-blocknote-editor--readonly'}`}>
        <style>{`
          .card-blocknote-editor {
          }
          .card-blocknote-editor .bn-container,
          .card-blocknote-editor .bn-editor,
          .card-blocknote-editor .ProseMirror,
          .card-blocknote-editor .mantine-RichTextEditor-root,
          .card-blocknote-editor .mantine-RichTextEditor-content {
            font-size: inherit !important;
            line-height: inherit !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            background: transparent !important;
            color: inherit !important;
          }
          .card-blocknote-editor [data-position="right"],
          .card-blocknote-editor .mantine-Menu-itemSection[data-position="right"] {
            display: none !important;
          }
          .card-blocknote-editor [data-content-type=quote] blockquote {
            border-left: 3px solid rgba(0,0,0,0.15) !important;
            font-style: italic !important;
          }
          .card-blocknote-editor .bn-visual-media {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 6px !important;
            display: block !important;
            margin: 4px 0 !important;
          }
          .card-blocknote-editor .bn-drag-handle-button {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .card-blocknote-editor .bn-drag-handle-button svg {
            width: 16px !important;
            height: 16px !important;
            opacity: 0.35 !important;
            transition: opacity 0.15s !important;
          }
          .card-blocknote-editor .bn-drag-handle-button:hover svg,
          .card-blocknote-editor .bn-drag-handle-button[data-state="open"] svg {
            opacity: 1 !important;
          }
        `}</style>
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme={theme}
          formattingToolbar={false}
          slashMenu={false}
          sideMenu={false}
        >
          {showSideMenu && editable && <SideMenuController sideMenu={DragOnlySideMenu} />}
          {editable && <CardFormattingToolbar />}
          {editable && <CardSlashMenu />}
        </BlockNoteView>
        {editable && <ImageToolbar containerRef={containerRef} editable={editable} theme={theme} />}
      </div>
    )
  }

export const CardBlockNoteEditor = forwardRef<BlockNoteEditorHandle, BlockNoteEditorProps>(CardBlockNoteEditorInner)

