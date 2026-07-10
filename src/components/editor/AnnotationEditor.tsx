import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { parseContentToBlocks, SAVE_DEBOUNCE_MS } from '../../converters/richTextUtils'
import { annotationSchema } from './annotationSchema'
import { usePosAtCoordsScalePatch } from './usePosAtCoordsScalePatch'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import type { AnnotationAlign } from '../../types/card'

export interface AnnotationEditorHandle {
  focus: () => void
  blur: () => void
}

export interface AnnotationEditorProps {
  content: string
  onChange: (content: string) => void
  onFocus?: () => void
  /** 失焦时回调，参数为最终内容（已 flush），便于判断是否为空 */
  onBlur?: (finalContent: string) => void
  align: AnnotationAlign
  editable?: boolean
}

/**
 * 文本注释节点的精简单段落 BlockNote 编辑器。
 *
 * 与 CardBlockNoteEditor 的差异：
 * - 使用 annotationSchema（仅 paragraph + 默认内联），更轻量
 * - 不挂 SlashMenu / FormattingToolbar / MentionMenu / TagSuggestionMenu（保持克制）
 * - 不处理图片粘贴/拖拽、cardReference/tag 点击、selectAll 两段式
 * - 粗体/斜体/链接走键盘快捷键
 *
 * 缩放兼容复用 usePosAtCoordsScalePatch，与卡片编辑器同机制。
 */
export const AnnotationEditor = forwardRef<AnnotationEditorHandle, AnnotationEditorProps>(
  function AnnotationEditor(
    { content, onChange, onFocus, onBlur, align, editable = true }: AnnotationEditorProps,
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const initialContent = useRef<unknown[] | undefined>(undefined)
    const isFirstRender = useRef(true)
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dirtyRef = useRef(false)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const isSelfUpdateRef = useRef(false)
    const isDarkMode = useIsDarkMode()

    if (isFirstRender.current) {
      initialContent.current = parseContentToBlocks(content)
      isFirstRender.current = false
    }

    const editor = useCreateBlockNote({
      schema: annotationSchema,
      initialContent: initialContent.current as Parameters<typeof useCreateBlockNote>[0] extends { initialContent?: infer T } ? T : never,
      placeholders: {
        emptyDocument: 'Enter text',
      },
    })

    const flushPending = useCallback((): string => {
      const finalContent = JSON.stringify(editor.document)
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
      if (dirtyRef.current) {
        dirtyRef.current = false
        onChangeRef.current(finalContent)
      }
      return finalContent
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

    // 外部 content 变更同步（undo/redo）
    useEffect(() => {
      if (isSelfUpdateRef.current) {
        isSelfUpdateRef.current = false
        return
      }
      const nextBlocks = parseContentToBlocks(content)
      const currentJson = JSON.stringify(editor.document)
      const nextJson = JSON.stringify(nextBlocks ?? [])
      if (currentJson === nextJson) return
      if (editable && editor.isFocused()) return

      const currentIds = editor.document.map((block) => block.id)
      const replacement = nextBlocks && nextBlocks.length > 0 ? nextBlocks : [{ type: 'paragraph' }]
      if (currentIds.length > 0) {
        editor.replaceBlocks(currentIds, replacement as Parameters<typeof editor.replaceBlocks>[1])
      }
    }, [content, editor, editable])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const handleFocusIn = () => onFocus?.()
      const handleFocusOut = (e: FocusEvent) => {
        if (!el.contains(e.relatedTarget as Node)) {
          // 先 flush 待写内容，再把最终内容传给 onBlur
          const flushed = flushPending()
          onBlur?.(flushed)
        }
      }
      el.addEventListener('focusin', handleFocusIn)
      el.addEventListener('focusout', handleFocusOut)
      return () => {
        el.removeEventListener('focusin', handleFocusIn)
        el.removeEventListener('focusout', handleFocusOut)
      }
    }, [onFocus, onBlur, flushPending])

    usePosAtCoordsScalePatch(editor)

    useImperativeHandle(ref, () => ({
      focus: () => {
        editor.focus()
        requestAnimationFrame(() => {
          const firstBlock = editor.document[0]
          if (!firstBlock) return
          editor.setTextCursorPosition(firstBlock.id, 'end')
        })
      },
      blur: () => (editor as { blur?: () => void }).blur?.(),
    }), [editor])

    const alignCss = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'

    return (
      <div
        ref={containerRef}
        className={`card-blocknote-editor annotation-editor ${
          editable ? 'card-blocknote-editor--editable' : 'card-blocknote-editor--readonly'
        }`}
        style={{
          fontSize: 'var(--anno-font-size, 14px)',
          lineHeight: 1.4,
          textAlign: alignCss,
        }}
      >
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme={isDarkMode ? 'dark' : 'light'}
          formattingToolbar={false}
          slashMenu={false}
          sideMenu={false}
        />
      </div>
    )
  },
)
