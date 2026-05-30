import DOMPurify from 'dompurify'
import { memo, lazy, Suspense, useMemo } from 'react'
import type { BlockNoteEditorHandle } from '../../editor/BlockNoteEditor'
import { useCardStore } from '../../../stores/cardStore'

const LazyCardBlockNoteEditor = lazy(() =>
  import('../../editor/BlockNoteEditor').then(m => ({ default: m.CardBlockNoteEditor }))
)

interface CardContentProps {
  isEditing: boolean
  isSelected: boolean
  cardId: string
  content: string
  previewHTML?: string
  enforceInitialHeading?: boolean
  onChange: (content: string) => void
  onFocus?: () => void
  onBlur: () => void
  editorRef: React.Ref<BlockNoteEditorHandle>
  textColor: string
  onDragBlocksOutside?: (blocks: unknown[]) => void
}

export const CardContent = memo(function CardContent({
  isEditing,
  isSelected,
  cardId,
  content,
  previewHTML,
  enforceInitialHeading,
  onChange,
  onFocus,
  onBlur,
  editorRef,
  textColor,
  onDragBlocksOutside,
}: CardContentProps) {
  const canScroll = isSelected || isEditing

  const sanitizedHTML = useMemo(() => {
    // Use store's lazy getPreviewHTML — generates on first access, caches after
    const raw = previewHTML || useCardStore.getState().getPreviewHTML(cardId) || '<span style="opacity:0.5">双击编辑...</span>'
    return DOMPurify.sanitize(raw, { ALLOWED_URI_REGEXP: /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i })
  }, [previewHTML, cardId, content])

  return (
    <div
      className="pb-3"
      style={{
        height: 'calc(100% - 28px)',
        color: textColor,
        cursor: isEditing ? 'text' : undefined,
        overflow: isEditing ? 'visible' : 'hidden',
      }}
      onWheelCapture={canScroll ? (e) => e.stopPropagation() : undefined}
    >
      {isSelected ? (
        <div
          className="h-full overflow-y-auto px-6"
          style={{ fontSize: '13px', lineHeight: '1.5' }}
        >
          <Suspense fallback={null}>
            <LazyCardBlockNoteEditor
              ref={editorRef}
              content={content}
              onChange={onChange}
              onFocus={onFocus}
              onBlur={onBlur}
              theme="light"
              editable={isEditing}
              showSideMenu={isEditing}
              enforceInitialHeading={enforceInitialHeading}
              onDragBlocksOutside={onDragBlocksOutside}
            />
          </Suspense>
        </div>
      ) : (
        <div
          className="h-full overflow-y-auto px-6"
          style={{
            fontSize: '13px',
            lineHeight: '1.5',
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
        />
      )}
    </div>
  )
})