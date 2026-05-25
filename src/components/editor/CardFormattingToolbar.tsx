import { useEffect, useRef } from 'react'
import { FormattingToolbarController } from '@blocknote/react'

export function CardFormattingToolbar() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const observer = new MutationObserver(() => {
      const floatingEl = wrapper.querySelector('[style*="position: fixed"], [style*="position:fixed"]') as HTMLElement | null
      if (!floatingEl) return
    })

    observer.observe(wrapper, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <FormattingToolbarController
        floatingOptions={{ strategy: 'fixed' }}
      />
    </div>
  )
}