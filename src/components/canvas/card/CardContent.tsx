import { memo } from 'react'
import { CardBlockNoteEditor, type BlockNoteEditorHandle } from '../../editor/BlockNoteEditor'
import { renderBlocksToHTML } from '../../../utils/renderBlocks'

interface CardContentProps {
  isEditing: boolean
  isSelected: boolean
  content: string
  previewHTML?: string
  enforceInitialHeading?: boolean
  onChange: (content: string) => void
  onBlur: () => void
  editorRef: React.Ref<BlockNoteEditorHandle>
  textColor: string
}

export const CardContent = memo(function CardContent({
  isEditing,
  isSelected,
  content,
  previewHTML,
  enforceInitialHeading,
  onChange,
  onBlur,
  editorRef,
  textColor,
}: CardContentProps) {
  const canScroll = isSelected || isEditing

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
      {isEditing ? (
        <div
          className="h-full overflow-y-auto px-6"
          style={{ fontSize: '13px', lineHeight: '1.5' }}
        >
          <CardBlockNoteEditor
            ref={editorRef}
            content={content}
            onChange={onChange}
            onBlur={onBlur}
            theme="light"
            editable={true}
            showSideMenu={false}
            enforceInitialHeading={enforceInitialHeading}
          />
        </div>
      ) : (
        <div
          className="h-full overflow-y-auto px-6"
          style={{
            fontSize: '13px',
            lineHeight: '1.5',
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{
            __html:
              previewHTML ||
              renderBlocksToHTML(content) ||
              '<span style="opacity:0.5">双击编辑...</span>',
          }}
        />
      )}
    </div>
  )
})