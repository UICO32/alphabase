// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CardLibrarySkeleton } from './CardLibrarySkeleton'

afterEach(cleanup)

describe('CardLibrarySkeleton', () => {
  it('matches the compact toolbar and card-list geometry', () => {
    render(createElement(CardLibrarySkeleton, { compact: true }))

    expect(screen.getByRole('status', { name: '正在加载卡片库' })).toBeTruthy()
    expect(screen.getByTestId('card-library-skeleton-toolbar')).toBeTruthy()
    expect(screen.getAllByTestId('card-library-skeleton-card')).toHaveLength(6)
  })
})
