// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useLibraryStore } from '../../../stores/libraryStore'
import { usePanelStore } from '../../../stores/panelStore'
import { SummaryButton } from './SummaryButton'

beforeEach(() => {
  useLibraryStore.setState({ sortBy: 'updatedAt', sortBeforeRelated: 'updatedAt', relatedSourceCardId: null })
  usePanelStore.setState({ rightPanelCollapsed: true, rightPanelActiveTab: 'editor' })
})

afterEach(cleanup)

describe('SummaryButton similar cards action', () => {
  it('opens the card library with an explicit relevance source', () => {
    render(createElement(SummaryButton, { color: 'white', visible: true, cardId: 'card-source' }))

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    fireEvent.click(screen.getByRole('button', { name: /寻找相似卡片/ }))

    expect(useLibraryStore.getState()).toMatchObject({
      sortBy: 'related',
      relatedSourceCardId: 'card-source',
    })
    expect(usePanelStore.getState()).toMatchObject({
      rightPanelCollapsed: false,
      rightPanelActiveTab: 'library',
    })
  })
})
