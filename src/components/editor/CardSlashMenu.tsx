import { SuggestionMenuController } from '@blocknote/react'

export function CardSlashMenu() {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      floatingOptions={{ strategy: 'fixed' }}
    />
  )
}