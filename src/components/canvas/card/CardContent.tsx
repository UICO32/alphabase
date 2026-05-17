import { CardBlockNoteEditor, type BlockNoteEditorHandle } from '../../editor/BlockNoteEditor'
import { renderBlocksToHTML } from '../../../utils/renderBlocks'

interface CardContentProps {
  isEditing: boolean
  content: string
  previewHTML?: string
  enforceInitialHeading?: boolean
  onChange: (content: string) => void
  onBlur: () => void
  editorRef: React.Ref<BlockNoteEditorHandle>
  textColor: string
}

export function CardContent({
  isEditing,
  content,
  previewHTML,
  enforceInitialHeading,
  onChange,
  onBlur,
  editorRef,
  textColor,
}: CardContentProps) {
  return (
    <div
      className="overflow-y-auto px-6 pb-3"
      style={{
        height: 'calc(100% - 28px)',
        color: textColor,
        cursor: isEditing ? 'text' : undefined,
        fontSize: '13px',
        lineHeight: '1.5',
        wordBreak: 'break-word',
      }}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      {isEditing ? (
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
      ) : (
        <div
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
}