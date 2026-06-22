import { mkdir, exists, readdir, writeFile, readFile, deleteFile, rmdir, readJSON } from '../utils/workspace/fs'
import type { TrashFile } from '../utils/workspace/types'

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

    return backupDir
  } catch {
    return null
  }
}

export async function listFileSystemBackups(workspacePath: string): Promise<{ timestamp: string; createdAt: number }[]> {
  const backupBase = getBackupBasePath(workspacePath)
  if (!(await exists(backupBase))) return []
  const dirs = await readdir(backupBase)
  return dirs
    .filter(name => /^\d+$/.test(name))
    .map(timestamp => ({ timestamp, createdAt: Number(timestamp) }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function restoreFromBackup(
  timestamp: string,
  workspacePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const backupBase = getBackupBasePath(workspacePath)
    const backupDir = `${backupBase}/${timestamp}`

    // Verify backup exists
    if (!(await exists(backupDir))) {
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
            await deleteFile(`${destDir}/${file}`)
          }
        }
      } else {
        await mkdir(destDir)
      }

      // Copy backup files to destination
      await copyDir(srcDir, destDir)
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
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
