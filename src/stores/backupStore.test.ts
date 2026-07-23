import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createFileSystemBackup,
  getBackupBasePath,
  getFileSystemBackupSummary,
  listFileSystemBackups,
  restoreFromBackup,
} from './backupStore'

// Mock fs module
vi.mock('../utils/workspace/fs', () => ({
  exists: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  deleteFile: vi.fn(),
  rmdir: vi.fn(),
  readJSON: vi.fn(),
}))

import { exists, readdir, mkdir, deleteFile, writeFile } from '../utils/workspace/fs'

const mockExists = vi.mocked(exists)
vi.mocked(readdir)
vi.mocked(mkdir)
vi.mocked(deleteFile)
vi.mocked(writeFile)

describe('backupStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Reflect.deleteProperty(window, 'electronAPI')
  })

  describe('getBackupBasePath', () => {
    it('should return backup path inside workspace .backups directory', () => {
      const result = getBackupBasePath('/data/workspaces/my-workspace')
      expect(result).toBe('/data/workspaces/my-workspace/.backups')
    })

    it('should handle Windows-style paths', () => {
      const result = getBackupBasePath('D:\\data\\workspaces\\my-workspace')
      expect(result).toBe('D:/data/workspaces/my-workspace/.backups')
    })
  })

  describe('restoreFromBackup', () => {
    it('should return error when backup directory does not exist', async () => {
      mockExists.mockResolvedValue(false)
      const result = await restoreFromBackup('1234567890', '/workspace/test')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Backup not found')
    })

    it('should return error on unexpected exception', async () => {
      mockExists.mockRejectedValue(new Error('disk error'))

      const result = await restoreFromBackup('1234567890', '/workspace/test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('disk error')
    })
  })

  describe('Electron backup compatibility', () => {
    it('forwards automatic backup creation while preserving the legacy string result', async () => {
      const createAutomatic = vi.fn().mockResolvedValue({ success: true, path: 'D:/workspace/.backups/123' })
      window.electronAPI = { backup: {
        selectExternal: vi.fn(),
        createAutomatic,
        listRecent: vi.fn(),
        exportCurrent: vi.fn(),
        exportRecent: vi.fn(),
        restoreExternal: vi.fn(),
        restoreRecent: vi.fn(),
        openExportDirectory: vi.fn(),
      } } as unknown as Window['electronAPI']

      await expect(createFileSystemBackup('D:/workspace')).resolves.toBe('D:/workspace/.backups/123')
      expect(createAutomatic).toHaveBeenCalledWith('D:/workspace')
    })

    it('maps rich recent backup summaries to the existing caller contracts', async () => {
      const rich: BackupSummary = {
        path: 'D:/workspace/.backups/123',
        timestamp: '123',
        createdAt: 123,
        cardCount: 4,
        boardCount: 2,
        trashCount: 1,
        mediaCount: 3,
        format: 'current',
        warnings: [],
      }
      const listRecent = vi.fn().mockResolvedValue([rich])
      window.electronAPI = { backup: {
        selectExternal: vi.fn(),
        createAutomatic: vi.fn(),
        listRecent,
        exportCurrent: vi.fn(),
        exportRecent: vi.fn(),
        restoreExternal: vi.fn(),
        restoreRecent: vi.fn(),
        openExportDirectory: vi.fn(),
      } } as unknown as Window['electronAPI']

      await expect(listFileSystemBackups('D:/workspace')).resolves.toEqual([{ timestamp: '123', createdAt: 123 }])
      await expect(getFileSystemBackupSummary('123', 'D:/workspace')).resolves.toEqual({
        timestamp: '123', createdAt: 123, cardCount: 4, boardCount: 2,
      })
    })
  })
})
