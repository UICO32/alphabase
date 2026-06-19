import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, type ForwardedRef } from 'react'
import { dropCursor } from '@tiptap/pm/dropcursor'
import { TextSelection, EditorState } from '@tiptap/pm/state'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { undoDepth, redoDepth } from 'prosemirror-history'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import type { PartialBlock } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import './card-blocknote-editor.css'
import { ImageToolbar } from './ImageToolbar'
import { CardFormattingToolbar } from './CardFormattingToolbar'
import { CardSlashMenu } from './CardSlashMenu'
import { CardMentionMenu } from './CardMentionMenu'
import { TagSuggestionMenu } from './TagSuggestionMenu'
import { useImageColumnDrop } from './useImageColumnDrop'
import { usePosAtCoordsScalePatch } from './usePosAtCoordsScalePatch'
import { useViewStore } from '../../stores/viewStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { fileToDataUrl, isImageFile } from '../../utils/fileUtils'
import { isMarkdown } from './utils/markdownDetect'
import { showToast } from '../../utils/toast'
import {
  isReadableImageUrl,
  readClipboardImageFiles,
  parseContentToBlocks,
  toComparableJson,
  SAVE_DEBOUNCE_MS
} from '../../converters/richTextUtils'
import { cardSchema } from './blocknoteSchema'

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
  enforceInitialHeading?: boolean
  scrollRestorePosition?: number
  onNavigateToCard?: (cardId: string) => void
  onTagClick?: (tagName: string) => void
  cardId?: string
}

function getProseMirrorView(editor: unknown) {
  return (editor as Record<string, unknown>).prosemirrorView as
    | { posAtCoords: (p: { left: number; top: number }) => { pos: number } | null
        posAtDOM: (node: Node, offset: number) => number
        state: EditorState & { doc: ProseMirrorNode & { resolve: (pos: number) => any }; tr: { setSelection: (sel: unknown) => unknown } }
        dispatch: (tr: unknown) => void
        focus: () => void
        dom: HTMLElement }
    | undefined
}

const CardBlockNoteEditorInner = (
  { content, onChange, onFocus, onBlur, theme = 'light', editable = true, enforceInitialHeading = false, scrollRestorePosition, onNavigateToCard, onTagClick, cardId }: BlockNoteEditorProps,
  ref: ForwardedRef<BlockNoteEditorHandle>
) => {
    const initialContent = useRef<unknown[] | undefined>(undefined)
    const isFirstRender = useRef(true)
    const containerRef = useRef<HTMLDivElement>(null)
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dirtyRef = useRef(false)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const selectAllStepRef = useRef(0)
    const isSelfUpdateRef = useRef(false)

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
      schema: cardSchema,
      initialContent: initialContent.current as Parameters<typeof useCreateBlockNote>[0] extends { initialContent?: infer T } ? T : never,
      uploadFile,
      dropCursor: () => dropCursor({
        color: 'var(--line-active, #3b82f6)',
        width: 3,
      }),
      pasteHandler: ({ event, defaultPasteHandler }) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        const isPlainTextPaste = (event as unknown as { shiftKey: boolean }).shiftKey

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
          const plainText = clipboardData.getData('text/plain')
          if (plainText && !isPlainTextPaste && isMarkdown(plainText)) {
            editor.pasteMarkdown(plainText)
            showToast('已将 Markdown 转换为富文本，Ctrl+Shift+V 粘贴纯文本', 3000)
            return true
          }
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
          const pm = getProseMirrorView(editor)
          if (!pm || !pm.dom.isConnected) return

          let pos: number | null = null

          // Method 1: Browser caretFromPoint APIs — precise when they work,
          // but unreliable under CSS transform: scale() (React Flow zoom).
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
          } catch { /* fall through */ }

          // Method 2: When caretFromPoint fails (common under scale()),
          // walk the DOM to find the text node closest to the click y,
          // then use posAtDOM for an exact position — this avoids the
          // posAtCoords fallback which, when monkey-patched by
          // usePosAtCoordsScalePatch, only returns block-boundary positions
          // (start/end of paragraph) instead of in-line positions.
          if (pos == null) {
            try {
              const clickY = y
              const clickX = x
              let bestNode: Text | null = null
              let bestOffset = 0
              let bestDist = Infinity

              const walker = document.createTreeWalker(pm.dom, NodeFilter.SHOW_TEXT)
              let textNode: Text | null
              while ((textNode = walker.nextNode() as Text | null)) {
                const parent = textNode.parentElement
                if (!parent) continue
                const rect = parent.getBoundingClientRect()
                // Use a generous y tolerance (half a line) so clicks between
                // lines still land on the nearest text node rather than falling
                // through to the coarse block-boundary fallback (Method 3).
                if (clickY < rect.top - rect.height / 2 || clickY > rect.bottom + rect.height / 2) continue
                const midY = (rect.top + rect.bottom) / 2
                const dist = Math.abs(clickY - midY)
                if (dist < bestDist) {
                  bestDist = dist
                  bestNode = textNode
                  // Approximate offset: use Range to measure the actual text
                  // bounds for better x-position accuracy than simple rect ratio.
                  const len = textNode.textContent?.length ?? 0
                  if (len === 0) {
                    bestOffset = 0
                  } else {
                    // Binary-search: find the character offset whose Range end
                    // is closest to clickX.
                    let lo = 0
                    let hi = len
                    const range = document.createRange()
                    while (lo < hi) {
                      const mid = (lo + hi) >>> 1
                      range.setStart(textNode, mid)
                      range.setEnd(textNode, mid)
                      const cx = range.getBoundingClientRect().left + 1 // +1 for >0 width
                      if (cx <= clickX) lo = mid + 1
                      else hi = mid
                    }
                    bestOffset = Math.max(0, Math.min(lo, len))
                  }
                }
              }

              if (bestNode) {
                pos = pm.posAtDOM(bestNode, bestOffset)
              }
            } catch { /* fall through */ }
          }

          // Method 3: Final fallback — posAtCoords. Under scale() this
          // returns block-boundary positions (block start or end), which is
          // better than nothing but causes the "cursor at paragraph head" bug.
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

          if (scrollRestorePosition != null && scrollRestorePosition > 0) {
            const scrollContainer = pm.dom.closest('.overflow-y-auto') as HTMLElement | null
            if (scrollContainer) {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  scrollContainer.scrollTop = scrollRestorePosition
                })
              })
            }
          }
        })
      },
      canUndo: () => {
        const pm = getProseMirrorView(editor)
        if (!pm) return false
        return undoDepth(pm.state) > 0
      },
      canRedo: () => {
        const pm = getProseMirrorView(editor)
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
      }
      if (dirtyRef.current) {
        dirtyRef.current = false
        onChangeRef.current(JSON.stringify(editor.document))
      }
    }, [editor])

    const handleChange = useCallback(() => {
      isSelfUpdateRef.current = true
      dirtyRef.current = true
      if (pendingTimerRef.current !== null) clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null
        if (!dirtyRef.current) return
        dirtyRef.current = false
        onChangeRef.current(JSON.stringify(editor.document))
      }, SAVE_DEBOUNCE_MS)
    }, [editor])

    useEffect(() => {
      const unsub = editor.onChange(handleChange)
      return () => {
        unsub?.()
        if (dirtyRef.current) {
          dirtyRef.current = false
          onChangeRef.current(JSON.stringify(editor.document))
        }
        if (pendingTimerRef.current !== null) {
          clearTimeout(pendingTimerRef.current)
          pendingTimerRef.current = null
        }
      }
    }, [editor, handleChange])

    useEffect(() => {
      editor.isEditable = editable
    }, [editor, editable])

    useEffect(() => {
      if (isSelfUpdateRef.current) {
        isSelfUpdateRef.current = false
        return
      }

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

    // Ctrl+A 两段式：第一次选中当前内容块，第二次选中所有内容块
    useEffect(() => {
      const el = containerRef.current
      if (!el || !editable) return

      const handleCtrlA = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey) || event.key !== 'a') return
        const target = event.target
        if (!(target instanceof Node) || !el.contains(target)) return

        const pmView = getProseMirrorView(editor)
        if (!pmView) return
        const st = pmView.state

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

        if (selectAllStepRef.current === 1) {
          selectAllStepRef.current = 0
          event.preventDefault()
          event.stopImmediatePropagation()
          if (currentBlockFrom === allFrom && currentBlockTo === allTo) {
            const sel = TextSelection.create(st.doc as unknown as Parameters<typeof TextSelection.create>[0], currentBlockFrom, currentBlockTo)
            pmView.dispatch(st.tr.setSelection(sel))
          } else if (!isAllBlocks) {
            const sel = TextSelection.create(st.doc as unknown as Parameters<typeof TextSelection.create>[0], allFrom, allTo)
            pmView.dispatch(st.tr.setSelection(sel))
          }
          return
        }

        selectAllStepRef.current = 1
        event.preventDefault()
        event.stopImmediatePropagation()
        if (!isCurrentBlock) {
          const sel = TextSelection.create(st.doc as unknown as Parameters<typeof TextSelection.create>[0], currentBlockFrom, currentBlockTo)
          pmView.dispatch(st.tr.setSelection(sel))
        }
      }

      const resetStep = () => { selectAllStepRef.current = 0 }
      const resetStepOnKey = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') return
        resetStep()
      }
      el.addEventListener('click', resetStep, true)
      el.addEventListener('keydown', resetStepOnKey, true)

      el.addEventListener('keydown', handleCtrlA, true)
      return () => {
        el.removeEventListener('keydown', handleCtrlA, true)
        el.removeEventListener('click', resetStep, true)
        el.removeEventListener('keydown', resetStepOnKey, true)
      }
    }, [editor, editable])

    return (
      <div ref={containerRef} spellCheck={false} style={{ position: 'relative', fontSize: '13px', lineHeight: '1.5' }} className={`card-blocknote-editor ${editable ? 'card-blocknote-editor--editable' : 'card-blocknote-editor--readonly'}`} onClickCapture={(e) => {
        const cardRef = (e.target as HTMLElement).closest('[data-card-id]')
        if (cardRef) {
          const id = cardRef.getAttribute('data-card-id')
          if (id) {
            e.preventDefault()
            e.stopPropagation()
            onNavigateToCard?.(id)
            return
          }
        }
        const tagEl = (e.target as HTMLElement).closest('[data-tag-name]')
        if (tagEl) {
          const tagName = tagEl.getAttribute('data-tag-name')
          if (tagName) {
            e.preventDefault()
            e.stopPropagation()
            onTagClick?.(tagName)
            return
          }
        }
        const anchor = (e.target as HTMLElement).closest('a')
        if (anchor && anchor.href && (anchor.href.startsWith('http://') || anchor.href.startsWith('https://'))) {
          e.preventDefault()
          e.stopPropagation()
          const viewState = useViewStore.getState()
          if (!viewState.editingCardId && cardId) {
            viewState.setEditingCardId(cardId)
          }
          useLibraryStore.getState().setWebviewUrl(anchor.href, cardId ?? undefined)
        }
      }}>
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme={theme}
          formattingToolbar={false}
          slashMenu={false}
          sideMenu={false}
        >
          {editable && <CardFormattingToolbar />}
          {editable && <CardSlashMenu editor={editor as any} />}
          {editable && <CardMentionMenu editor={editor as any} />}
          {editable && <TagSuggestionMenu editor={editor as any} cardId={cardId} />}
        </BlockNoteView>
        {editable && <ImageToolbar containerRef={containerRef} editable={editable} theme={theme} />}
      </div>
    )
  }

export const CardBlockNoteEditor = forwardRef<BlockNoteEditorHandle, BlockNoteEditorProps>(CardBlockNoteEditorInner)
