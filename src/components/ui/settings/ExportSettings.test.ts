import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { getBackupCapabilities } from '../../../platform/electronCapabilities'
import { flushActiveSyncEngine, stopActiveSyncEngine } from '../../../sync/syncEngineRef'
import { cleanupSubscriptions } from '../../../sync/subscriptionManager'
import { ExportSettings } from './ExportSettings'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../platform/electronCapabilities', () => ({ getBackupCapabilities: vi.fn() }))
vi.mock('../../../sync/syncEngineRef', () => ({
  flushActiveSyncEngine: vi.fn().mockResolvedValue(undefined),
  stopActiveSyncEngine: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../../sync/subscriptionManager', () => ({ cleanupSubscriptions: vi.fn() }))
vi.mock('../../../stores/eventBus', () => ({
  emit: vi.fn(),
  on: vi.fn((_event: string, listener: () => void) => {
    queueMicrotask(listener)
    return vi.fn()
  }),
}))

const summary: BackupSummary = {
  path: 'D:/backup/1700000000000',
  timestamp: '1700000000000',
  createdAt: 1_700_000_000_000,
  cardCount: 3,
  boardCount: 2,
  trashCount: 1,
  mediaCount: 4,
  format: 'current',
  warnings: [],
}

function backupAPI() {
  return {
    selectExternal: vi.fn().mockResolvedValue({ success: true, summary, path: summary.path }),
    createAutomatic: vi.fn(),
    listRecent: vi.fn().mockResolvedValue([summary]),
    exportCurrent: vi.fn().mockResolvedValue({ success: true, path: 'C:/Downloads/Abase Backups/export-1', summary }),
    exportRecent: vi.fn().mockResolvedValue({ success: true, path: 'C:/Downloads/Abase Backups/export-2', summary }),
    restoreExternal: vi.fn(),
    restoreRecent: vi.fn(),
    openExportDirectory: vi.fn().mockResolvedValue(undefined),
  }
}

describe('ExportSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('hepta-last-workspace-path', 'D:/workspace')
  })

  afterEach(() => cleanup())

  it('lists recent backups newest-first with counts and format status', async () => {
    const api = backupAPI()
    vi.mocked(getBackupCapabilities).mockReturnValue({ ok: true, value: api })

    render(createElement(ExportSettings))

    expect(await screen.findByText('3 张卡片 · 2 个画板 · 1 项回收站 · 4 个媒体文件')).toBeTruthy()
    expect(screen.getByText('当前格式')).toBeTruthy()
    expect(api.listRecent).toHaveBeenCalledWith('D:/workspace')
  })

  it('exports the current workspace to the fixed capability and offers to open the reported path', async () => {
    const api = backupAPI()
    vi.mocked(getBackupCapabilities).mockReturnValue({ ok: true, value: api })
    render(createElement(ExportSettings))

    fireEvent.click(screen.getByRole('button', { name: '导出完整备份' }))

    await waitFor(() => expect(api.exportCurrent).toHaveBeenCalledWith('D:/workspace'))
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('C:/Downloads/Abase Backups/export-1'))
    fireEvent.click(screen.getByRole('button', { name: '打开目录' }))
    await waitFor(() => expect(api.openExportDirectory).toHaveBeenCalledWith('C:/Downloads/Abase Backups/export-1'))
  })

  it('selects a directory backup and shows its validation summary before restore', async () => {
    const api = backupAPI()
    vi.mocked(getBackupCapabilities).mockReturnValue({ ok: true, value: api })
    render(createElement(ExportSettings))

    fireEvent.click(screen.getByRole('button', { name: '选择备份文件夹' }))

    expect(await screen.findByText('确认替换当前工作区')).toBeTruthy()
    expect(screen.getByRole('button', { name: '创建安全备份并恢复' })).toBeTruthy()
    expect(api.selectExternal).toHaveBeenCalledTimes(1)
  })

  it('includes the intended default destination in export failures', async () => {
    const api = backupAPI()
    api.exportCurrent.mockResolvedValue({
      success: false,
      stage: 'export',
      path: 'C:/Downloads/Abase Backups',
      error: 'disk full',
    })
    vi.mocked(getBackupCapabilities).mockReturnValue({ ok: true, value: api })
    render(createElement(ExportSettings))

    fireEvent.click(screen.getByRole('button', { name: '导出完整备份' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('C:/Downloads/Abase Backups')))
  })

  it('stops active workspace writers before replacing files', async () => {
    const api = backupAPI()
    api.restoreExternal.mockResolvedValue({
      success: false,
      stage: 'replacement',
      error: 'EBUSY',
      safetyBackupPath: 'D:/workspace/.backups/safety',
    })
    vi.mocked(getBackupCapabilities).mockReturnValue({ ok: true, value: api })
    render(createElement(ExportSettings))

    fireEvent.click(screen.getByRole('button', { name: '选择备份文件夹' }))
    fireEvent.click(await screen.findByRole('button', { name: '创建安全备份并恢复' }))

    await waitFor(() => expect(api.restoreExternal).toHaveBeenCalled())
    expect(vi.mocked(flushActiveSyncEngine).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(stopActiveSyncEngine).mock.invocationCallOrder[0])
    expect(vi.mocked(stopActiveSyncEngine).mock.invocationCallOrder[0])
      .toBeLessThan(api.restoreExternal.mock.invocationCallOrder[0])
    expect(cleanupSubscriptions).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('EBUSY'))
  })

  it('reports rejected backup IPC operations instead of failing silently', async () => {
    const api = backupAPI()
    api.exportCurrent.mockRejectedValue(new Error('IPC unavailable'))
    vi.mocked(getBackupCapabilities).mockReturnValue({ ok: true, value: api })
    render(createElement(ExportSettings))

    fireEvent.click(screen.getByRole('button', { name: '导出完整备份' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('IPC unavailable'))
  })
})
