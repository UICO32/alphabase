import { beforeEach, describe, expect, it } from 'vitest'
import { useMediaPlaybackStore } from './mediaPlaybackStore'

describe('mediaPlaybackStore', () => {
  beforeEach(() => useMediaPlaybackStore.setState({ activeNodeId: null }))

  it('keeps a single active video node', () => {
    useMediaPlaybackStore.getState().activate('first')
    useMediaPlaybackStore.getState().activate('second')
    expect(useMediaPlaybackStore.getState().activeNodeId).toBe('second')
  })

  it('does not let an inactive node stop the active one', () => {
    useMediaPlaybackStore.getState().activate('active')
    useMediaPlaybackStore.getState().deactivate('other')
    expect(useMediaPlaybackStore.getState().activeNodeId).toBe('active')
  })
})
