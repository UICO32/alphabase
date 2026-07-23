import { mkdir, exists, readdir, writeFile, readFile, deleteFile, rmdir, readJSON } from '../utils/workspace/fs'
import type { TrashFile } from '../utils/workspace/types'
import { auditWorkspaceEvent, auditWorkspaceHealth } from '../utils/workspace/audit'
import { getBackupCapabilities } from '../platform/electronCapabilities'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'

const MAX_FILE_BACKUPS = 10
const AUTO_BACKUP_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export function getBackupBasePath(workspacePath: string): string {
  // 备份必须在工作区内：工作区外的路径会被 isPathWithinWorkspace 安全护栏拒绝，
  // 导致冲突弹窗的「使用备份恢复」永不出现、createFileSystemBackup 静默失败。
  return `${workspacePath.replace(/\\/g, '/')}/.backups`
}

export async function copyDir(srcDir: string, destDir: string): Promise<void> {
  if (!(await exists(srcDir))) return
  await mkdir(destDir)
  const files = await readdir(srcDir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const content = await readFile(`${srcDir}/${file}`)
    await writeFile(`${destDir}/${file}`, content)
  }
}

async function removeDir(dirPath: string): Promise<void> {
  if (!(await exists(dirPath))) return
  const files = await readdir(dirPath)
  for (const f of files) await deleteFile(`${dirPath}/${f}`)
  await rmdir(dirPath).catch(() => {})
}

export async function createFileSystemBackup(workspacePath: string): Promise<string | null> {
  try {
    await auditWorkspaceHealth(workspacePath, 'backup-create-before')
    const capabilities = getBackupCapabilities()
    if (capabilities.ok) {
      const result = await capabilities.value.createAutomatic(workspacePath)
      if (!result.success || !result.path) throw new Error(result.error || 'Automatic backup failed')
      await auditWorkspaceHealth(workspacePath, 'backup-create-after', { backupDir: result.path })
      auditWorkspaceEvent({
        action: 'backup-create-success',
        workspacePath,
        path: result.path,
      })
      return result.path
    }
    if (capabilities.reason === 'ipc-error') throw capabilities.error

    const timestamp = Date.now().toString()
    const backupBase = getBackupBasePath(workspacePath)
    const backupDir = `${backupBase}/${timestamp}`

    await mkdir(backupDir)

    await copyDir(`${workspacePath}/cards`, `${backupDir}/cards`)
    await copyDir(`${workspacePath}/boards`, `${backupDir}/boards`)
    await copyDir(`${workspacePath}/trash`, `${backupDir}/trash`)

    // Prune old backups
    const allBackups = (await readdir(backupBase))
      .filter(name => /^\d+$/.test(name))
      .sort()

    while (allBackups.length > MAX_FILE_BACKUPS) {
      const old = allBackups.shift()!
      const oldDir = `${backupBase}/${old}`
      await removeDir(`${oldDir}/cards`)
      await removeDir(`${oldDir}/boards`)
      await removeDir(`${oldDir}/trash`)
      await rmdir(oldDir).catch(() => {})
    }

    await auditWorkspaceHealth(workspacePath, 'backup-create-after', { backupDir })
    auditWorkspaceEvent({
      action: 'backup-create-success',
      workspacePath,
      path: backupDir,
    })
    return backupDir
  } catch (err) {
    auditWorkspaceEvent({
      level: 'error',
      action: 'backup-create-failed',
      workspacePath,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export async function listFileSystemBackups(workspacePath: string): Promise<{ timestamp: string; createdAt: number }[]> {
  const capabilities = getBackupCapabilities()
  if (capabilities.ok) {
    const backups = await capabilities.value.listRecent(workspacePath)
    return backups.map(({ timestamp, createdAt }) => ({ timestamp, createdAt }))
  }
  if (capabilities.reason === 'ipc-error') throw capabilities.error

  const backupBase = getBackupBasePath(workspacePath)
  if (!(await exists(backupBase))) return []
  const dirs = await readdir(backupBase)
  return dirs
    .filter(name => /^\d+$/.test(name))
    .map(timestamp => ({ timestamp, createdAt: Number(timestamp) }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getFileSystemBackupSummary(
  timestamp: string,
  workspacePath: string,
): Promise<{ timestamp: string; createdAt: number; cardCount: number; boardCount: number } | null> {
  const capabilities = getBackupCapabilities()
  if (capabilities.ok) {
    const backup = (await capabilities.value.listRecent(workspacePath))
      .find(item => item.timestamp === timestamp)
    return backup
      ? { timestamp: backup.timestamp, createdAt: backup.createdAt, cardCount: backup.cardCount, boardCount: backup.boardCount }
      : null
  }
  if (capabilities.reason === 'ipc-error') throw capabilities.error

  const backupBase = getBackupBasePath(workspacePath)
  const backupDir = `${backupBase}/${timestamp}`
  if (!(await exists(backupDir))) return null

  const cardsDir = `${backupDir}/cards`
  const boardsDir = `${backupDir}/boards`
  const cardCount = (await exists(cardsDir))
    ? (await readdir(cardsDir)).filter(file => file.endsWith('.json')).length
    : 0

  let boardCount = 0
  const manifestPath = `${boardsDir}/_manifest.json`
  if (await exists(manifestPath)) {
    try {
      const manifest = await readJSON<{ boards?: unknown[] }>(manifestPath)
      boardCount = Array.isArray(manifest.boards) ? manifest.boards.length : 0
    } catch {
      boardCount = 0
    }
  } else if (await exists(boardsDir)) {
    boardCount = (await readdir(boardsDir)).filter(file => file.endsWith('.json') && file !== '_manifest.json').length
  }

  return { timestamp, createdAt: Number(timestamp), cardCount, boardCount }
}

export async function restoreFromBackup(
  timestamp: string,
  workspacePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await auditWorkspaceHealth(workspacePath, 'backup-restore-before', { timestamp })
    const capabilities = getBackupCapabilities()
    if (capabilities.ok) {
      await flushActiveSyncEngine()
      const result = await capabilities.value.restoreRecent(workspacePath, timestamp)
      if (!result.success) return { success: false, error: result.error || `Restore failed during ${result.stage || 'unknown stage'}` }
      await auditWorkspaceHealth(workspacePath, 'backup-restore-after', {
        timestamp,
        backupDir: result.path,
        safetyBackupPath: result.safetyBackupPath,
      })
      auditWorkspaceEvent({
        action: 'backup-restore-success',
        workspacePath,
        path: result.path,
        details: { timestamp, safetyBackupPath: result.safetyBackupPath },
      })
      return { success: true }
    }
    if (capabilities.reason === 'ipc-error') throw capabilities.error

    const backupBase = getBackupBasePath(workspacePath)
    const backupDir = `${backupBase}/${timestamp}`

    // Verify backup exists
    if (!(await exists(backupDir))) {
      auditWorkspaceEvent({
        level: 'error',
        action: 'backup-restore-missing-backup',
        workspacePath,
        path: backupDir,
        details: { timestamp },
      })
      return { success: false, error: `Backup not found: ${timestamp}` }
    }

    // Safety: create a backup of current state before overwriting
    await createFileSystemBackup(workspacePath)

    // Restore each subdirectory: cards, boards, trash
    const subdirs = ['cards', 'boards', 'trash']
    for (const subdir of subdirs) {
      const srcDir = `${backupDir}/${subdir}`
      const destDir = `${workspacePath}/${subdir}`

      if (!(await exists(srcDir))) continue

      // Clear destination directory (remove all .json files)
      if (await exists(destDir)) {
        const existingFiles = await readdir(destDir)
        for (const file of existingFiles) {
          if (file.endsWith('.json')) {
            auditWorkspaceEvent({
              action: 'backup-restore-delete-existing-file',
              workspacePath,
              path: `${destDir}/${file}`,
              details: { timestamp, subdir },
            })
            await deleteFile(`${destDir}/${file}`)
          }
        }
      } else {
        await mkdir(destDir)
      }

      // Copy backup files to destination
      await copyDir(srcDir, destDir)
    }

    await auditWorkspaceHealth(workspacePath, 'backup-restore-after', { timestamp, backupDir })
    auditWorkspaceEvent({
      action: 'backup-restore-success',
      workspacePath,
      path: backupDir,
      details: { timestamp },
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    auditWorkspaceEvent({
      level: 'error',
      action: 'backup-restore-failed',
      workspacePath,
      error: message,
      details: { timestamp },
    })
    return { success: false, error: message }
  }
}

// --- Auto backup scheduler ---

let autoBackupTimer: ReturnType<typeof setInterval> | null = null
let currentWorkspacePath: string | null = null

async function cleanExpiredTrash(workspacePath: string): Promise<void> {
  const trashDir = `${workspacePath}/trash`
  if (!(await exists(trashDir))) return
  const files = await readdir(trashDir)
  const now = Date.now()
  for (const file of files) {
    if (!file.endsWith('.trash.json')) continue
    try {
      const item = await readJSON<TrashFile>(`${trashDir}/${file}`)
      if (item.expiresAt <= now) {
        await deleteFile(`${trashDir}/${file}`)
      }
    } catch {
      // skip invalid files
    }
  }
}

export function startAutoBackup(workspacePath: string): void {
  stopAutoBackup()
  currentWorkspacePath = workspacePath
  // 启动时立即清理过期 trash
  cleanExpiredTrash(workspacePath).catch(() => {})
  autoBackupTimer = setInterval(() => {
    if (currentWorkspacePath) {
      createFileSystemBackup(currentWorkspacePath).catch(() => {})
      cleanExpiredTrash(currentWorkspacePath).catch(() => {})
    }
  }, AUTO_BACKUP_INTERVAL_MS)
}

export function stopAutoBackup(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer)
    autoBackupTimer = null
  }
  currentWorkspacePath = null
}
