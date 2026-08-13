import DOMPurify from 'dompurify'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Ref,
} from 'react'
import { useCardStore } from '../../stores/cardStore'
import type { BlockNoteEditorHandle, BlockNoteEditorProps } from './BlockNoteEditor'
import { LazyCardBlockNoteEditor } from './cardEditorLoader'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import {
  createEditorEntryState,
  editorEntryReducer,
} from './editorEntryTransition'
import { editorElementSnapshot, editorTrace } from './editorTrace'
import './card-blocknote-editor.css'

interface CardEditorEntryProps extends Omit<BlockNoteEditorProps, 'onReady'> {
  entryKey: string
  previewHTML?: string
  editorRef?: Ref<BlockNoteEditorHandle>
  onBeforeReveal?: () => void
  mountEditor?: boolean
  revealAfterPaint?: boolean
  onUserInput?: () => void
}

const ALLOWED_PREVIEW_URI = /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i

function EditorTraceFallback({ label }: { label?: string }) {
  useEffect(() => {
    editorTrace(label, 'lazy-editor-suspense-fallback-mounted')
    return () => editorTrace(label, 'lazy-editor-suspense-fallback-unmounted')
  }, [label])
  return null
}

export function CardEditorEntry({
  entryKey,
  previewHTML,
  editorRef,
  onBeforeReveal,
  mountEditor = true,
  revealAfterPaint = false,
  onUserInput,
  ...editorProps
}: CardEditorEntryProps) {
  const [state, dispatch] = useReducer(editorEntryReducer, entryKey, createEditorEntryState)
  const activeKeyRef = useRef(entryKey)
  const frameRef = useRef<number | null>(null)
  const revealTokenRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const traceLabel = editorProps.debugTraceLabel

  activeKeyRef.current = entryKey
  const effectivePhase = state.entryKey === entryKey ? state.phase : 'mounting'

  const sanitizedPreviewHTML = useMemo(() => {
    // interactive 后 preview 层已隐藏（编辑内容由 ProseMirror 接管），
    // 不再需要为整卡做 renderBlocksToHTML + DOMPurify——打字落盘每 400ms
    // 触发一次 useMemo 重算，这里 O(1) 直接返回，避免大卡片同步转换卡顿。
    if (effectivePhase === 'interactive') return ''
    const cardId = editorProps.cardId
    const raw = previewHTML
      || (cardId ? useCardStore.getState().getPreviewHTML(cardId) : '')
      || '<span style="opacity:0.5">双击编辑...</span>'
    return DOMPurify.sanitize(raw, { ALLOWED_URI_REGEXP: ALLOWED_PREVIEW_URI, ADD_URI_SAFE_ATTR: ['type'] })
  }, [effectivePhase, editorProps.cardId, editorProps.content, previewHTML])
  useEffect(() => {
    editorTrace(traceLabel, 'editor-entry-phase-committed', {
      effectivePhase,
      mountEditor,
      snapshot: editorElementSnapshot(rootRef.current),
    })
  }, [effectivePhase, mountEditor, traceLabel])

  useEffect(() => {
    dispatch({ type: 'reset', entryKey })
    return () => {
      revealTokenRef.current += 1
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [entryKey])

  const handleReady = useCallback(() => {
    const readyKey = entryKey
    const revealToken = ++revealTokenRef.current
    editorTrace(traceLabel, 'editor-entry-on-ready-received', {
      entryKey: readyKey,
      revealToken,
      snapshot: editorElementSnapshot(rootRef.current),
    })
    dispatch({ type: 'ready', entryKey: readyKey })

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    const focusAfterReveal = () => {
      // 先让 interactive 状态完成一次绘制，再做精确光标定位。
      // 即便后续命中需要布局兜底，也不会阻塞这次 pointer 交互的首帧。
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        if (activeKeyRef.current !== readyKey || revealTokenRef.current !== revealToken) return
        onBeforeReveal?.()
      })
    }
    const commitInteractive = (afterPaint: boolean) => {
      dispatch({ type: 'interactive', entryKey: readyKey })
      editorTrace(traceLabel, 'editor-entry-interactive-dispatched', { revealToken, afterPaint })
      focusAfterReveal()
    }
    const reveal = () => {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        if (activeKeyRef.current !== readyKey || revealTokenRef.current !== revealToken) return
        if (!revealAfterPaint) {
          commitInteractive(false)
          return
        }

        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null
          if (activeKeyRef.current !== readyKey || revealTokenRef.current !== revealToken) return
          commitInteractive(true)
        })
      })
    }

    if (revealAfterPaint && typeof document !== 'undefined' && document.fonts) {
      void document.fonts.ready.then(() => {
        if (activeKeyRef.current !== readyKey || revealTokenRef.current !== revealToken) return
        editorTrace(traceLabel, 'editor-entry-fonts-ready', {
          fontStatus: document.fonts.status,
          revealToken,
        })
        reveal()
      })
    } else {
      reveal()
    }
  }, [entryKey, onBeforeReveal, revealAfterPaint, traceLabel])

  return (
    <div
      ref={rootRef}
      className="card-editor-entry nodrag"
      data-editor-entry-phase={effectivePhase}
      onPointerDown={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onInputCapture={() => {
        const text = rootRef.current?.querySelector('.ProseMirror')?.textContent ?? ''
        if (text.replace(/[\s\u200b\ufeff]/g, '').length > 0) onUserInput?.()
      }}
    >
      {effectivePhase !== 'interactive' && (
        <div
          aria-hidden="true"
          className="card-editor-entry__preview bn-editor bn-default-styles card-preview-native"
          dangerouslySetInnerHTML={{ __html: sanitizedPreviewHTML }}
        />
      )}
      <div className="card-editor-entry__editor">
        {mountEditor && (
          <Suspense fallback={<EditorTraceFallback label={traceLabel} />}>
            <LazyCardBlockNoteEditor
              ref={editorRef}
              {...editorProps}
              onReady={handleReady}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
