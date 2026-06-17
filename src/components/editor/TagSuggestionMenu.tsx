import { SuggestionMenuController } from '@blocknote/react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { BlockNoteEditor } from '@blocknote/core'
import { filterSuggestionItems } from './blocknoteSchema'
import { useCardStore } from '../../stores/cardStore'

interface TagSuggestionItem extends DefaultReactSuggestionItem {
  tagName: string
}

export function TagSuggestionMenu({ editor, cardId }: { editor: BlockNoteEditor<any, any, any>; cardId?: string }) {
  const getItems = async (query: string) => {
    const cards = useCardStore.getState().cards
    const tagSet = new Set<string>()
    for (const card of Object.values(cards)) {
      if (card.tags) {
        for (const tag of card.tags) {
          tagSet.add(tag)
        }
      }
    }

    const allItems: TagSuggestionItem[] = Array.from(tagSet)
      .sort()
      .map(tagName => ({
        title: tagName,
        subtext: '标签',
        tagName,
        icon: (
          <span style={{ color: '#8b5cf6', fontWeight: 600, fontSize: '13px' }}>#</span>
        ),
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: 'tag',
              props: { tagName },
              content: [{ type: 'text', text: tagName, styles: {} }],
            },
          ])
          // Also add tag to current card's tags array if cardId provided
          if (cardId) {
            const card = useCardStore.getState().cards[cardId]
            if (card && (!card.tags || !card.tags.includes(tagName))) {
              useCardStore.getState().updateCard(cardId, {
                tags: [...(card.tags || []), tagName],
              })
            }
          }
        },
      }))

    return filterSuggestionItems(allItems, query)
  }

  return (
    <SuggestionMenuController
      triggerCharacter="#"
      getItems={getItems}
      floatingOptions={{ strategy: 'fixed' }}
    />
  )
}
