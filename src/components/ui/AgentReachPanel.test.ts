// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentReachPanel, clearAgentReachBrowseCacheForTests } from './AgentReachPanel'

vi.mock('../../stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: unknown) => unknown) => selector({ currentWorkspace: { path: 'D:/workspace' } }),
}))
vi.mock('../../stores/cardStore', () => ({ useCardStore: { getState: vi.fn() } }))
vi.mock('../../stores/viewStore', () => ({ useViewStore: { getState: vi.fn() } }))
vi.mock('../../stores/panelStore', () => ({ usePanelStore: { getState: vi.fn() } }))
vi.mock('../../stores/libraryStore', () => ({ useLibraryStore: { getState: vi.fn() } }))
vi.mock('../../stores/eventBus', () => ({ emit: vi.fn() }))
vi.mock('../../utils/clipper', () => ({ clipUrl: vi.fn() }))
vi.mock('../../converters/htmlToBlocks', () => ({ htmlToBlocks: vi.fn() }))

afterEach(() => {
  cleanup()
  clearAgentReachBrowseCacheForTests()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('AgentReachPanel refresh', () => {
  it('keeps control labels horizontal in contained overflow regions', async () => {
    const browse = vi.fn().mockResolvedValue({ items: [] })
    ;(window as unknown as { electronAPI?: unknown }).electronAPI = { clipper: { agentReachBrowse: browse } }
    render(createElement(AgentReachPanel))
    await waitFor(() => expect(browse).toHaveBeenCalledTimes(1))

    expect(screen.getByTestId('agent-reach-platforms').className).toContain('overflow-x-auto')
    expect(screen.getByTestId('agent-reach-platforms').className).toContain('whitespace-nowrap')
    expect(screen.getByTestId('agent-reach-actions').className).toContain('overflow-x-auto')
    expect(screen.getByTestId('agent-reach-actions').className).toContain('whitespace-nowrap')
  })

  it('refreshes only the active view, retains old results, and does not poison cache on failure', async () => {
    let rejectRefresh!: (reason?: unknown) => void
    const browse = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 'old', title: 'Old result', url: 'https://example.com/old' }] })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRefresh = reject }))
      .mockResolvedValueOnce({ items: [{ id: 'new', title: 'New result', url: 'https://example.com/new' }] })
    ;(window as unknown as { electronAPI?: unknown }).electronAPI = { clipper: { agentReachBrowse: browse } }

    render(createElement(AgentReachPanel))
    expect(await screen.findByText('Old result')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '刷新当前频道' }))
    expect(screen.getByText('Old result')).toBeTruthy()
    expect((screen.getByRole('button', { name: '刷新当前频道' }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => rejectRefresh(new Error('refresh failed')))
    expect(await screen.findByText('refresh failed')).toBeTruthy()
    expect(screen.getByText('Old result')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '刷新当前频道' }))
    expect(await screen.findByText('New result')).toBeTruthy()
    expect(browse).toHaveBeenCalledTimes(3)
    expect(browse.mock.calls[1][0]).toMatchObject({ platform: 'bilibili', action: 'hot' })
    expect(browse.mock.calls[2][0]).toMatchObject({ platform: 'bilibili', action: 'hot' })
  })

  it('repeats a non-empty search and leaves other cache entries available', async () => {
    const browse = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 'hot', title: 'Cached hot', url: 'https://example.com/hot' }] })
      .mockResolvedValueOnce({ items: [{ id: 'search', title: 'Search result', url: 'https://example.com/search' }] })
      .mockResolvedValueOnce({ items: [{ id: 'fresh-search', title: 'Fresh search', url: 'https://example.com/fresh' }] })
    ;(window as unknown as { electronAPI?: unknown }).electronAPI = { clipper: { agentReachBrowse: browse } }

    render(createElement(AgentReachPanel))
    expect(await screen.findByText('Cached hot')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('搜索...'), { target: { value: 'design systems' } })
    fireEvent.keyDown(screen.getByPlaceholderText('搜索...'), { key: 'Enter' })
    expect(await screen.findByText('Search result')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '刷新当前频道' }))
    expect(await screen.findByText('Fresh search')).toBeTruthy()
    expect(browse.mock.calls[2][0]).toMatchObject({
      platform: 'bilibili',
      action: 'search',
      query: 'design systems',
    })

    fireEvent.click(screen.getByRole('button', { name: '热门' }))
    expect(await screen.findByText('Cached hot')).toBeTruthy()
    expect(browse).toHaveBeenCalledTimes(3)
  })
})
