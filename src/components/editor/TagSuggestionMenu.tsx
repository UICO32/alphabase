import { SuggestionMenuController } from '@blocknote/react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { BlockNoteEditor } from '@blocknote/core'
import { filterSuggestionItems } from './blocknoteSchema'
import { useCardStore } from '../../stores/cardStore'
import { useTagStore } from '../../stores/tagStore'

interface TagSuggestionItem extends DefaultReactSuggestionItem {
  tagName: string
}

export function TagSuggestionMenu({ editor, cardId }: { editor: BlockNoteEditor<any, any, any>; cardId?: string }) {
  const getItems = async (query: string) => {
    const sorted = useTagStore.getState().getTagsSortedByUsage()

    const allItems: TagSuggestionItem[] = sorted
      .map(t => ({
        title: t.name,
        subtext: t.flomoSynced ? `${t.count} 张卡片 · flomo` : `${t.count} 张卡片`,
        tagName: t.name,
        icon: (
          <span style={{ color: 'var(--tag-color)', fontWeight: 600, fontSize: '13px' }}>#</span>
        ),
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: 'tag',
              props: { tagName: t.name },
              content: [{ type: 'text', text: t.name, styles: {} }],
            },
          ])
          if (cardId) {
            const card = useCardStore.getState().cards[cardId]
            if (card && (!card.tags || !card.tags.includes(t.name))) {
              useCardStore.getState().updateCard(cardId, {
                tags: [...(card.tags || []), t.name],
              })
              useTagStore.getState().ensureTag(t.name)
            }
          }
        },
      }))

    // If query doesn't match any existing tag, offer to create
    const filtered = filterSuggestionItems(allItems, query)
    if (query.trim() && allItems.every(t => t.tagName !== query.trim())) {
      const newTagName = query.trim()
      return [
        {
          title: newTagName,
          subtext: '创建新标签',
          tagName: newTagName,
          icon: (
            <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '13px' }}>+</span>
          ),
          onItemClick: () => {
            useTagStore.getState().ensureTag(newTagName)
            editor.insertInlineContent([
              {
                type: 'tag',
                props: { tagName: newTagName },
                content: [{ type: 'text', text: newTagName, styles: {} }],
              },
            ])
            if (cardId) {
              const card = useCardStore.getState().cards[cardId]
              if (card && (!card.tags || !card.tags.includes(newTagName))) {
                useCardStore.getState().updateCard(cardId, {
                  tags: [...(card.tags || []), newTagName],
                })
              }
            }
          },
        },
        ...filtered,
      ]
    }

    return filtered
  }

  return (
    <SuggestionMenuController
      triggerCharacter="#"
      getItems={getItems}
      floatingOptions={{ strategy: 'fixed' }}
    />
  )
}
