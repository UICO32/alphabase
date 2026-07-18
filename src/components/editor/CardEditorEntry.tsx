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
import {
  createEditorEntryState,
  editorEntryReducer,
} from './editorEntryTransition'
import './card-blocknote-editor.css'

interface CardEditorEntryProps extends Omit<BlockNoteEditorProps, 'onReady'> {
  entryKey: string
  previewHTML?: string
  editorRef?: Ref<BlockNoteEditorHandle>
  onBeforeReveal?: () => void
}

const ALLOWED_PREVIEW_URI = /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i

export function CardEditorEntry({
  entryKey,
  previewHTML,
  editorRef,
  onBeforeReveal,
  ...editorProps
}: CardEditorEntryProps) {
  const [state, dispatch] = useReducer(editorEntryReducer, entryKey, createEditorEntryState)
  const activeKeyRef = useRef(entryKey)
  const frameRef = useRef<number | null>(null)

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
    dispatch({ type: 'reset', entryKey })
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [entryKey])

  const handleReady = useCallback(() => {
    const readyKey = entryKey
    onBeforeReveal?.()
    dispatch({ type: 'ready', entryKey: readyKey })

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      if (activeKeyRef.current !== readyKey) return
      dispatch({ type: 'interactive', entryKey: readyKey })
    })
  }, [entryKey, onBeforeReveal])

  return (
    <div className="card-editor-entry" data-editor-entry-phase={effectivePhase}>
      {effectivePhase !== 'interactive' && (
        <div
          aria-hidden="true"
          className="card-editor-entry__preview bn-editor bn-default-styles card-preview-native"
          dangerouslySetInnerHTML={{ __html: sanitizedPreviewHTML }}
        />
      )}
      <div className="card-editor-entry__editor">
        <Suspense fallback={null}>
          <LazyCardBlockNoteEditor
            ref={editorRef}
            {...editorProps}
            onReady={handleReady}
          />
        </Suspense>
      </div>
    </div>
  )
}
