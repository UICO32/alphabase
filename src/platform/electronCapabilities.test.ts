import { afterEach, describe, expect, it } from 'vitest'
import { getElectronCapabilities, getStartupCapabilities } from './electronCapabilities'

describe('getElectronCapabilities', () => {
  const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')

  afterEach(() => {
    if (originalElectronAPI) Object.defineProperty(window, 'electronAPI', originalElectronAPI)
    else Reflect.deleteProperty(window, 'electronAPI')
  })

  it('returns unavailable when the preload API is absent', () => {
    Reflect.deleteProperty(window, 'electronAPI')

    expect(getElectronCapabilities()).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('returns ipc-error when reading the preload API throws', () => {
    const error = new Error('preload bridge failed')
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      get: () => { throw error },
    })

    expect(getElectronCapabilities()).toEqual({ ok: false, reason: 'ipc-error', error })
  })

  it('treats a partial startup bridge as unavailable', () => {
    window.electronAPI = { startup: {} } as unknown as Window['electronAPI']

    expect(getStartupCapabilities()).toEqual({ ok: false, reason: 'unavailable' })
  })
})
