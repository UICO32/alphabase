// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CollapsedContent } from './CollapsedContent'

afterEach(cleanup)

describe('CollapsedContent', () => {
  it('renders only the collapsed body and clamps it to two lines', () => {
    render(createElement(CollapsedContent, {
      body: 'First body Second body',
      isEmpty: false,
      textColor: 'rgb(20, 30, 40)',
    }))

    const body = screen.getByText('First body Second body')
    expect(body.style.webkitLineClamp).toBe('2')
    expect(screen.queryByTestId('collapsed-card-title')).toBeNull()
  })

  it('does not insert an extra body row when only a title exists', () => {
    const { container } = render(createElement(CollapsedContent, {
      body: '',
      isEmpty: false,
      textColor: 'rgb(20, 30, 40)',
    }))

    expect(container.querySelector('span')).toBeNull()
  })

  it('shows the empty state for an empty card', () => {
    render(createElement(CollapsedContent, {
      body: '',
      isEmpty: true,
      textColor: 'rgb(20, 30, 40)',
    }))

    expect(screen.getByText('空卡片')).toBeTruthy()
  })
})
