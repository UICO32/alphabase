import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { IconButton } from './IconButton'

describe('interaction primitives', () => {
  it('exposes a persistent selected state without replacing ARIA semantics', () => {
    const { getByRole } = render(createElement(Button, {
      selected: true,
      'aria-pressed': true,
      children: '筛选',
    }))

    const button = getByRole('button', { name: '筛选' })
    expect(button.dataset.selected).toBe('true')
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps icon controls disabled while selected', () => {
    const { getByRole } = render(createElement(IconButton, {
      selected: true,
      disabled: true,
      'aria-label': '框选工具',
    }))

    const button = getByRole('button', { name: '框选工具' }) as HTMLButtonElement
    expect(button.dataset.selected).toBe('true')
    expect(button.disabled).toBe(true)
  })
})
