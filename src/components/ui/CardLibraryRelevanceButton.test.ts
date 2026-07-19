// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardLibraryRelevanceButton } from './CardLibraryRelevanceButton'

afterEach(cleanup)

const baseProps = {
  active: false,
  indexed: true,
  editingCardId: 'card-1',
  onActivate: vi.fn(),
}

describe('CardLibraryRelevanceButton', () => {
  it('activates relevance when it is available', () => {
    const onActivate = vi.fn()
    render(createElement(CardLibraryRelevanceButton, { ...baseProps, onActivate }))

    fireEvent.click(screen.getByRole('button', { name: '按当前卡片的相关性排序' }))
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it('exposes its selected state without collapsing the label', () => {
    render(createElement(CardLibraryRelevanceButton, { ...baseProps, active: true }))

    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.className).toContain('shrink-0')
    expect(button.className).toContain('whitespace-nowrap')
  })

  it('explains that a reference card is required', () => {
    render(createElement(CardLibraryRelevanceButton, { ...baseProps, editingCardId: null }))

    const button = screen.getByRole('button', { name: '相关性：请先选择一张卡片' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('请先选择一张卡片')
  })

  it('reports indexing progress instead of an indefinite preparing state', () => {
    render(createElement(CardLibraryRelevanceButton, {
      ...baseProps,
      indexed: false,
      indexing: true,
      progress: 3,
      total: 10,
    }))

    const button = screen.getByRole('button', { name: '相关性：正在建立卡片索引 3/10' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('正在建立卡片索引 3/10')
  })

  it('distinguishes a missing model from indexing progress', () => {
    render(createElement(CardLibraryRelevanceButton, {
      ...baseProps,
      indexed: false,
      indexError: 'model-missing',
    }))

    const button = screen.getByRole('button', { name: '相关性：请先在设置中下载向量模型' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('请先在设置中下载向量模型')
  })
})
