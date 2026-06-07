import { SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { BlockNoteEditor } from '@blocknote/core'

export function CardSlashMenu({ editor }: { editor: BlockNoteEditor<any, any, any> }) {
  const getItems = async (query: string) => {
    const defaultItems = getDefaultReactSlashMenuItems(editor)
    const imageRowItem: DefaultReactSuggestionItem = {
      title: '图片分列',
      subtext: '多张图片并排排列',
      badge: '新',
      aliases: ['images', 'tupianfenlie', 'imgrow'],
      group: 'Image Row',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
      onItemClick: () => {
        const block = editor.getTextCursorPosition().block
        if (block) {
          editor.insertBlocks(
            [{ type: 'imageRow', props: { urlsJson: '[]', captionsJson: '[]' } }],
            block,
            'after',
          )
        }
      },
    }
    const items = [...defaultItems, imageRowItem]
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.aliases?.some((a) => a.toLowerCase().includes(query.toLowerCase())),
    )
  }

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getItems}
      floatingOptions={{ strategy: 'fixed' }}
    />
  )
}