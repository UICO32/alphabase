import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BoardManifest } from '../utils/workspace/types'

// Mock fs module — each test controls return values per path.
// vi.mock is hoisted, so the mock object must be created inside the factory
// and re-imported after the mock declaration.
vi.mock('../utils/workspace/fs', () => {
  const m = {
    exists: vi.fn().mockResolvedValue(false),
    readdir: vi.fn().mockResolvedValue([]),
    readDirFiles: vi.fn().mockResolvedValue({}),
    readJSON: vi.fn(),
    writeJSON: vi.fn(),
    mkdir: vi.fn(),
    deleteFile: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    rmdir: vi.fn(),
    stat: vi.fn(),
  }
  return m
})

// Mock backupStore so WorkspaceService can call listFileSystemBackups/restoreFromBackup
vi.mock('../stores/backupStore', () => ({
  listFileSystemBackups: vi.fn(),
  restoreFromBackup: vi.fn(),
  getBackupBasePath: vi.fn(() => '/parent/.alphabase-backups/ws'),
  createFileSystemBackup: vi.fn(),
  startAutoBackup: vi.fn(),
  stopAutoBackup: vi.fn(),
}))

import { exists, readdir, readDirFiles, readJSON, writeJSON } from '../utils/workspace/fs'
import { listFileSystemBackups, restoreFromBackup } from '../stores/backupStore'
import { WorkspaceService } from './WorkspaceService'

const mockExists = vi.mocked(exists)
const mockReaddir = vi.mocked(readdir)
const mockReadDirFiles = vi.mocked(readDirFiles)
const mockReadJSON = vi.mocked(readJSON)
const mockWriteJSON = vi.mocked(writeJSON)
const mockListFileSystemBackups = vi.mocked(listFileSystemBackups)
const mockRestoreFromBackup = vi.mocked(restoreFromBackup)

const WORKSPACE = '/data/ws'

function svc() {
  const s = new WorkspaceService()
  s.setWorkspacePath(WORKSPACE)
  return s
}

describe('WorkspaceService.repairConsistency — catastrophic loss recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('restores from newest backup when manifest had boards but disk is empty (avoids cementing zero)', async () => {
    // Arrange: manifest on disk claims 2 boards, but neither board file exists.
    // cards/ directory exists but is empty. metadata claims 5 cards.
    const manifestWithBoards: BoardManifest = {
      boards: [
        { id: 'b1', name: '画板一', createdAt: 1, updatedAt: 2 },
        { id: 'b2', name: '画板二', createdAt: 1, updatedAt: 2 },
      ],
    }

    mockExists.mockImplementation(async (p: string) => {
      // manifest exists, but board files do NOT exist
      if (p === `${WORKSPACE}/boards/_manifest.json`) return true
      if (p === `${WORKSPACE}/boards/b1.json`) return false
      if (p === `${WORKSPACE}/boards/b2.json`) return false
      if (p === `${WORKSPACE}/cards`) return true
      if (p === `${WORKSPACE}/boards`) return true
      if (p === `${WORKSPACE}/trash`) return true
      return false
    })

    mockReaddir.mockResolvedValue([]) // no files in any dir

    mockReadJSON.mockImplementation(async (p: string) => {
      if (p === `${WORKSPACE}/boards/_manifest.json`) return manifestWithBoards
      throw new Error(`unexpected readJSON ${p}`)
    })

    mockReadDirFiles.mockResolvedValue({}) // no cards, no boards on disk

    // Backup exists with full data
    mockListFileSystemBackups.mockResolvedValue([
      { timestamp: '1781539721676', createdAt: 1781539721676 },
    ])
    mockRestoreFromBackup.mockResolvedValue({ success: true })
    mockRestoreFromBackup.mockResolvedValue({ success: true })

    // Act
    const result = await svc().repairConsistency()

    // Assert: it should have RESTORED from backup rather than writing empty manifest
    expect(mockRestoreFromBackup).toHaveBeenCalledWith('1781539721676', WORKSPACE)
    expect(result.repaired).toBe(true)
    expect(result.actions.some(a => a.toLowerCase().includes('restor'))).toBe(true)

    // Critical: it must NOT have written an empty manifest that cements the loss
    const wroteEmptyManifest = mockWriteJSON.mock.calls.some(
      ([path, data]) =>
        path === `${WORKSPACE}/boards/_manifest.json` &&
        (data as BoardManifest).boards.length === 0
    )
    expect(wroteEmptyManifest).toBe(false)
  })

  it('does NOT restore from backup when there is genuinely no data to lose (manifest was always empty)', async () => {
    // Arrange: manifest legitimately empty, no boards, no cards, no loss happened
    mockExists.mockResolvedValue(true)
    mockReaddir.mockResolvedValue([])
    mockReadDirFiles.mockResolvedValue({})
    mockReadJSON.mockImplementation(async (p: string) => {
      if (p === `${WORKSPACE}/boards/_manifest.json`) return { boards: [] }
      throw new Error(`unexpected readJSON ${p}`)
    })
    mockListFileSystemBackups.mockResolvedValue([
      { timestamp: '1781539721676', createdAt: 1781539721676 },
    ])
    mockRestoreFromBackup.mockResolvedValue({ success: true })

    const result = await svc().repairConsistency()

    // No catastrophic loss → must not call restore (would overwrite a legitimately empty workspace)
    expect(mockRestoreFromBackup).not.toHaveBeenCalled()
    expect(result.repaired).toBe(false)
  })

  it('falls back to pruning logic when backup restore fails, and reports the failure', async () => {
    // Arrange: manifest claims boards, disk empty, but restore fails
    mockExists.mockImplementation(async (p: string) => {
      if (p === `${WORKSPACE}/boards/_manifest.json`) return true
      if (p.startsWith(`${WORKSPACE}/boards/b`)) return false
      return true
    })
    mockReaddir.mockResolvedValue([])
    mockReadDirFiles.mockResolvedValue({})
    mockReadJSON.mockImplementation(async (p: string) => {
      if (p === `${WORKSPACE}/boards/_manifest.json`)
        return { boards: [{ id: 'b1', name: 'gone', createdAt: 1, updatedAt: 2 }] }
      throw new Error(`unexpected readJSON ${p}`)
    })
    mockListFileSystemBackups.mockResolvedValue([
      { timestamp: '1781539721676', createdAt: 1781539721676 },
    ])
    mockRestoreFromBackup.mockResolvedValue({ success: false, error: 'backup corrupted' })

    const result = await svc().repairConsistency()

    expect(mockRestoreFromBackup).toHaveBeenCalled()
    expect(result.repaired).toBe(true)
    // Should report that restore was attempted but failed
    expect(result.actions.some(a => a.toLowerCase().includes('fail') || a.toLowerCase().includes('restore'))).toBe(true)
  })

  it('does not restore when no backups exist, prunes instead', async () => {
    mockExists.mockImplementation(async (p: string) => {
      if (p.startsWith(`${WORKSPACE}/boards/b`)) return false // board file missing
      return true
    })
    mockReaddir.mockResolvedValue([])
    mockReadDirFiles.mockResolvedValue({})
    mockReadJSON.mockImplementation(async (p: string) => {
      if (p === `${WORKSPACE}/boards/_manifest.json`)
        return { boards: [{ id: 'b1', name: 'gone', createdAt: 1, updatedAt: 2 }] }
      throw new Error(`unexpected readJSON ${p}`)
    })
    mockListFileSystemBackups.mockResolvedValue([]) // no backups

    const result = await svc().repairConsistency()

    expect(mockRestoreFromBackup).not.toHaveBeenCalled()
    // Falls back to pruning the missing board
    expect(result.repaired).toBe(true)
    const wrotePrunedManifest = mockWriteJSON.mock.calls.some(
      ([path, data]) =>
        path === `${WORKSPACE}/boards/_manifest.json` &&
        (data as BoardManifest).boards.length === 0
    )
    expect(wrotePrunedManifest).toBe(true)
  })
})
