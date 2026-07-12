export type ElectronAPI = NonNullable<Window['electronAPI']>

export type ElectronCapabilitiesResult<T = ElectronAPI> =
  | { ok: true; value: T }
  | { ok: false; reason: 'unavailable' | 'ipc-error'; error?: unknown }

export function getElectronCapabilities(): ElectronCapabilitiesResult<ElectronAPI> {
  if (typeof window === 'undefined') return { ok: false, reason: 'unavailable' }

  try {
    const electronAPI = window.electronAPI
    return electronAPI
      ? { ok: true, value: electronAPI }
      : { ok: false, reason: 'unavailable' }
  } catch (error) {
    return { ok: false, reason: 'ipc-error', error }
  }
}

export function getStartupCapabilities(): ElectronCapabilitiesResult<ElectronAPI['startup']> {
  const capabilities = getElectronCapabilities()
  if (!capabilities.ok) return capabilities

  const startup = (capabilities.value as Partial<ElectronAPI>).startup
  if (
    !startup
    || typeof startup.notifyProgress !== 'function'
    || typeof startup.notifyDataReady !== 'function'
    || typeof startup.log !== 'function'
  ) {
    return { ok: false, reason: 'unavailable' }
  }

  return { ok: true, value: startup }
}
