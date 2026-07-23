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

export function getBackupCapabilities(): ElectronCapabilitiesResult<ElectronAPI['backup']> {
  const capabilities = getElectronCapabilities()
  if (!capabilities.ok) return capabilities

  const backup = (capabilities.value as Partial<ElectronAPI>).backup
  if (
    !backup
    || typeof backup.selectExternal !== 'function'
    || typeof backup.createAutomatic !== 'function'
    || typeof backup.listRecent !== 'function'
    || typeof backup.exportCurrent !== 'function'
    || typeof backup.exportRecent !== 'function'
    || typeof backup.restoreExternal !== 'function'
    || typeof backup.restoreRecent !== 'function'
    || typeof backup.openExportDirectory !== 'function'
  ) {
    return { ok: false, reason: 'unavailable' }
  }

  return { ok: true, value: backup }
}
