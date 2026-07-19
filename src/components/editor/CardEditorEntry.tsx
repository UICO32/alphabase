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
    const cardId = editorProps.cardId
    const raw = previewHTML
      || (cardId ? useCardStore.getState().getPreviewHTML(cardId) : '')
      || '<span style="opacity:0.5">双击编辑...</span>'
    return DOMPurify.sanitize(raw, { ALLOWED_URI_REGEXP: ALLOWED_PREVIEW_URI })
  }, [editorProps.cardId, editorProps.content, previewHTML])
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
    onBeforeReveal?.()
    dispatch({ type: 'ready', entryKey: readyKey })

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    const reveal = () => {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        if (activeKeyRef.current !== readyKey || revealTokenRef.current !== revealToken) return
        if (!revealAfterPaint) {
          dispatch({ type: 'interactive', entryKey: readyKey })
          editorTrace(traceLabel, 'editor-entry-interactive-dispatched', { revealToken, afterPaint: false })
          return
        }

        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null
          if (activeKeyRef.current !== readyKey || revealTokenRef.current !== revealToken) return
          dispatch({ type: 'interactive', entryKey: readyKey })
          editorTrace(traceLabel, 'editor-entry-interactive-dispatched', { revealToken, afterPaint: true })
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
    <div ref={rootRef} className="card-editor-entry" data-editor-entry-phase={effectivePhase}>
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
