import { describe, it, expect, vi, beforeEach } from 'vitest'
import { restoreFromBackup, getBackupBasePath } from './backupStore'

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
const mockReaddir = vi.mocked(readdir)
const mockMkdir = vi.mocked(mkdir)
const mockDeleteFile = vi.mocked(deleteFile)
const mockWriteFile = vi.mocked(writeFile)

describe('backupStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
