import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibraryStore } from '../../utils/libraryStore'
import { useCardStore } from '../../utils/cardStore'
import { getPanelSurface } from '../../theme'
import { CollapseButton } from './SharedUI'
import { CardLibraryView } from './CardLibraryView'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
import { Layers, FileText, ChevronLeft } from 'lucide-react'

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

  return (
    <>
      <AnimatePresence initial={false}>
        {!rightPanelCollapsed && (
          <motion.div
            key="right-panel"
            className="flex flex-col h-full border-l absolute right-0 top-0 z-10 overflow-hidden"
            style={{
              width: RIGHT_PANEL_WIDTH,
              backgroundColor: surface.panelBg,
              borderColor: surface.divider,
            }}
            initial={{ x: RIGHT_PANEL_WIDTH, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: RIGHT_PANEL_WIDTH, opacity: 0.8 }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 32,
              mass: 0.8,
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 border-b transition-theme"
              style={{ borderColor: surface.divider }}
            >
              <div className="flex gap-1">
                <button
                  onClick={() => setRightPanelActiveTab('library')}
                  className="panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
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
                  className="panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
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
                <div className="flex flex-col items-center justify-center h-full animate-fadeIn" style={{ color: surface.muted }}>
                  <FileText size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">选择卡片进行编辑</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed trigger button */}
      <AnimatePresence>
        {rightPanelCollapsed && (
          <motion.button
            key="right-trigger"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => setRightPanelCollapsed(false)}
            className="fixed top-3 right-3 z-50 flex items-center justify-center w-9 h-9 rounded-xl cursor-pointer shadow-lg"
            style={{
              backgroundColor: surface.panelBg,
              color: surface.text,
              border: `1px solid ${surface.divider}`,
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <ChevronLeft size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
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
      <div className="flex flex-col items-center justify-center h-full animate-fadeIn" style={{ color: '#71717a' }}>
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
