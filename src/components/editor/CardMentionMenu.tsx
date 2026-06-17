import { SuggestionMenuController } from '@blocknote/react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { BlockNoteEditor } from '@blocknote/core'
import { filterSuggestionItems } from './blocknoteSchema'
import { useCardStore } from '../../stores/cardStore'

interface CardMentionItem extends DefaultReactSuggestionItem {
  cardId: string
}

export function CardMentionMenu({ editor }: { editor: BlockNoteEditor<any, any, any> }) {
  const getItems = async (query: string) => {
    const cards = useCardStore.getState().cards
    const allItems: CardMentionItem[] = Object.values(cards)
      .filter(card => !card.deletedAt)
      .map(card => ({
        title: card.title || '无标题',
        subtext: card.id,
        cardId: card.id,
        icon: (
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              borderRadius: '3px',
              backgroundColor: card.color === 'white' ? '#e5e7eb' : `var(--card-color-${card.color}, #e5e7eb)`,
              flexShrink: 0,
            }}
          />
        ),
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: 'cardReference',
              props: { cardId: card.id },
              content: [{ type: 'text', text: card.title || '无标题', styles: {} }],
            },
          ])
        },
      }))

    return filterSuggestionItems(allItems, query)
  }

  return (
    <SuggestionMenuController
      triggerCharacter="@"
      getItems={getItems}
      floatingOptions={{ strategy: 'fixed' }}
    />
  )
}
