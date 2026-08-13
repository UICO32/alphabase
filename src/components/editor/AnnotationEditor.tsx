import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { SAVE_DEBOUNCE_MS } from '../../converters/richTextUtils'
import {
  annotationContentToText,
  annotationTextToContent,
} from '../../utils/annotationContent'
import type { AnnotationAlign } from '../../types/card'

export interface AnnotationEditorHandle {
  focus: () => void
  blur: () => void
}

export interface AnnotationEditorProps {
  content: string
  onChange: (content: string) => void
  onFocus?: () => void
  onBlur?: (finalContent: string) => void
  align: AnnotationAlign
  editable?: boolean
}

/**
 * Text annotations deliberately use a native textarea instead of BlockNote.
 * They need plain multiline text, immediate caret placement and content-sized
 * height; mounting a block editor here adds paragraph layout and focus races.
 */
export const AnnotationEditor = forwardRef<AnnotationEditorHandle, AnnotationEditorProps>(
  function AnnotationEditor(
    { content, onChange, onFocus, onBlur, align, editable = true },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [value, setValue] = useState(() => annotationContentToText(content))
    const valueRef = useRef(value)
    const dirtyRef = useRef(false)
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    const resizeToContent = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.style.height = '0px'
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [])

    const flushPending = useCallback(() => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
      const finalContent = annotationTextToContent(valueRef.current)
      if (dirtyRef.current) {
        dirtyRef.current = false
        onChangeRef.current(finalContent)
      }
      return finalContent
    }, [])

    const focusAtEnd = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus({ preventScroll: true })
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
    }, [])

    useImperativeHandle(ref, () => ({
      focus: focusAtEnd,
      blur: () => {
        const textarea = textareaRef.current
        if (textarea && document.activeElement === textarea) {
          textarea.blur()
          return
        }
        // A newly mounted annotation can be clicked away before the focus
        // frame runs. Commit explicitly so an empty node is still removed.
        onBlur?.(flushPending())
      },
    }), [flushPending, focusAtEnd, onBlur])

    useLayoutEffect(resizeToContent, [resizeToContent, value])

    useEffect(() => {
      if (!editable) return
      const frameId = requestAnimationFrame(focusAtEnd)
      return () => cancelAnimationFrame(frameId)
    }, [editable, focusAtEnd])

    useEffect(() => {
      const textarea = textareaRef.current
      if (textarea && document.activeElement === textarea) return
      const nextValue = annotationContentToText(content)
      if (nextValue === valueRef.current) return
      valueRef.current = nextValue
      setValue(nextValue)
    }, [content])

    useEffect(() => () => {
      if (pendingTimerRef.current !== null) clearTimeout(pendingTimerRef.current)
      if (dirtyRef.current) onChangeRef.current(annotationTextToContent(valueRef.current))
    }, [])

    const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value
      valueRef.current = nextValue
      dirtyRef.current = true
      setValue(nextValue)
      if (pendingTimerRef.current !== null) clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null
        if (!dirtyRef.current) return
        dirtyRef.current = false
        onChangeRef.current(annotationTextToContent(valueRef.current))
      }, SAVE_DEBOUNCE_MS)
    }, [])

    const handleBlur = useCallback(() => {
      onBlur?.(flushPending())
    }, [flushPending, onBlur])

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return
      if (event.key !== 'Escape' && !(event.key === 'Enter' && (event.metaKey || event.ctrlKey))) return
      event.preventDefault()
      event.currentTarget.blur()
    }, [])

    return (
      <textarea
        ref={textareaRef}
        className="annotation-textarea nodrag nowheel"
        value={value}
        readOnly={!editable}
        rows={1}
        placeholder={editable ? '输入文本' : undefined}
        spellCheck
        aria-label="文本注释"
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          textAlign: align,
          fontSize: 'var(--anno-font-size, 14px)',
        }}
      />
    )
  },
)
