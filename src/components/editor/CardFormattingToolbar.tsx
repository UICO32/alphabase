import { useRef } from 'react'
import { FormattingToolbarController } from '@blocknote/react'

export function CardFormattingToolbar() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <FormattingToolbarController
        floatingOptions={{ strategy: 'fixed' }}
      />
    </div>
  )
}
