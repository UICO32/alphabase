// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SummaryFormatMenu } from './SummaryFormatMenu'

afterEach(cleanup)

describe('SummaryFormatMenu', () => {
  it('exposes finding similar cards as a separate AI action', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    const onFindSimilar = vi.fn()

    render(createElement(SummaryFormatMenu, {
      color: 'white',
      triggerRef: { current: trigger },
      currentFormat: 'concise',
      onSelect: vi.fn(),
      onFindSimilar,
      onClose: vi.fn(),
    }))

    fireEvent.click(screen.getByRole('button', { name: /寻找相似卡片/ }))
    expect(onFindSimilar).toHaveBeenCalledOnce()
    trigger.remove()
  })
})
