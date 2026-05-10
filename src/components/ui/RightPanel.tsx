import { useCallback } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useCardStore } from '../../utils/cardStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { CollapseButton } from './SharedUI'
import { CardLibraryView } from './CardLibraryView'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
import { Layers, FileText } from 'lucide-react'

const RIGHT_PANEL_WIDTH = 320

export function RightPanel() {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const rightPanelCollapsed = useLibraryStore(s => s.rightPanelCollapsed)
  const setRightPanelCollapsed = useLibraryStore(s => s.setRightPanelCollapsed)
  const rightPanelActiveTab = useLibraryStore(s => s.rightPanelActiveTab)
  const setRightPanelActiveTab = useLibraryStore(s => s.setRightPanelActiveTab)
  const viewMode = useLibraryStore(s => s.viewMode)
  const editingCardId = useLibraryStore(s => s.editingCardId)

  const surface = getPanelSurface(isDarkMode)

  if (viewMode !== 'board') return null
  if (rightPanelCollapsed) return null

  return (
    <div
      className="flex flex-col h-full border-l relative z-10"
      style={{
        width: RIGHT_PANEL_WIDTH,
        backgroundColor: surface.panelBg,
        borderColor: surface.divider,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: surface.divider }}
      >
        <div className="flex gap-1">
          <button
            onClick={() => setRightPanelActiveTab('library')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              backgroundColor: rightPanelActiveTab === 'library' ? surface.surface : 'transparent',
              color: rightPanelActiveTab === 'library' ? surface.text : surface.muted,
            }}
          >
            <Layers size={14} />
            卡片库
          </button>
          <button
            onClick={() => setRightPanelActiveTab('editor')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              backgroundColor: rightPanelActiveTab === 'editor' ? surface.surface : 'transparent',
              color: rightPanelActiveTab === 'editor' ? surface.text : surface.muted,
            }}
          >
            <FileText size={14} />
            卡片编辑器
          </button>
        </div>
        <CollapseButton direction="right" onClick={() => setRightPanelCollapsed(true)} />
      </div>

      <div className="flex-1 overflow-hidden">
        {rightPanelActiveTab === 'library' ? (
          <CardLibraryView />
        ) : editingCardId ? (
          <CardEditorView cardId={editingCardId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: surface.muted }}>
            <FileText size={48} className="mb-4 opacity-30" />
            <p className="text-sm">选择卡片进行编辑</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CardEditorView({ cardId }: { cardId: string }) {
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: '#71717a' }}>
        <p className="text-sm">卡片不存在或已被删除</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-2">
      <CardBlockNoteEditor
        content={card.content}
        onChange={handleChange}
        editable={true}
      />
    </div>
  )
}
