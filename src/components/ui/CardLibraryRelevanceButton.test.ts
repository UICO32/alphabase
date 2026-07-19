// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardLibraryRelevanceButton } from './CardLibraryRelevanceButton'

afterEach(cleanup)

describe('CardLibraryRelevanceButton', () => {
  it('activates relevance when it is available', () => {
    const onActivate = vi.fn()
    render(createElement(CardLibraryRelevanceButton, {
      active: false,
      indexed: true,
      editingCardId: 'card-1',
      onActivate,
    }))

    fireEvent.click(screen.getByRole('button', { name: '相关性' }))
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it('exposes its selected state', () => {
    render(createElement(CardLibraryRelevanceButton, {
      active: true,
      indexed: true,
      editingCardId: 'card-1',
      onActivate: vi.fn(),
    }))

    expect(screen.getByRole('button', { name: '相关性' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('does not collapse its label into vertical text', () => {
    render(createElement(CardLibraryRelevanceButton, {
      active: false,
      indexed: true,
      editingCardId: 'card-1',
      onActivate: vi.fn(),
    }))

    const button = screen.getByRole('button')
    expect(button.className).toContain('shrink-0')
    expect(button.className).toContain('whitespace-nowrap')
  })

  it('is disabled without a reference card', () => {
    render(createElement(CardLibraryRelevanceButton, {
      active: false,
      indexed: true,
      editingCardId: null,
      onActivate: vi.fn(),
    }))

    const button = screen.getByRole('button', { name: '相关性' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('请先选择一张卡片')
  })

  it('is disabled while the card index is preparing', () => {
    render(createElement(CardLibraryRelevanceButton, {
      active: false,
      indexed: false,
      editingCardId: 'card-1',
      onActivate: vi.fn(),
    }))

    const button = screen.getByRole('button', { name: '相关性' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('卡片索引准备中')
  })
})
