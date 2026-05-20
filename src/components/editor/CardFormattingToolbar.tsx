import { useEffect, useRef } from 'react'
import { FormattingToolbarController } from '@blocknote/react'

export function CardFormattingToolbar() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const observer = new MutationObserver(() => {
      const floatingEl = wrapper.querySelector('[style*="position: fixed"], [style*="position:fixed"]')
      if (floatingEl) {
        const style = (floatingEl as HTMLElement).style
        console.log('[CardFormattingToolbar] floating element found:', {
          top: style.top,
          left: style.left,
          transform: style.transform,
          zIndex: style.zIndex,
          className: floatingEl.className?.substring(0, 60),
          text: floatingEl.textContent?.substring(0, 40),
          rect: floatingEl.getBoundingClientRect(),
        })
      } else {
        console.log('[CardFormattingToolbar] no floating element in wrapper, childCount:', wrapper.children.length)
        for (let i = 0; i < wrapper.children.length; i++) {
          const child = wrapper.children[i] as HTMLElement
          console.log(`  child[${i}]:`, {
            position: child.style.position,
            className: child.className?.substring(0, 40),
            text: child.textContent?.substring(0, 30),
          })
        }
      }
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