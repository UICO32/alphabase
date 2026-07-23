import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { isMediaFilenameSafe } from './workspacePaths'

export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_APP_ID = 'com.heptabase.canvas-v2'
export const BACKUP_DIRECTORY_NAME = 'Abase Backups'

const DATA_DIRECTORIES = ['cards', 'boards', 'trash', 'media'] as const
const MANIFEST_FILENAME = 'backup-manifest.json'
const METADATA_FILENAME = '_metadata.json'
const MAX_AUTOMATIC_BACKUPS = 10

export type BackupFormat = 'current' | 'legacy'
export type BackupFailureStage =
  | 'selection'
  | 'validation'
  | 'safety-backup'
  | 'staging'
  | 'replacement'
  | 'reload'
  | 'export'

export interface BackupManifest {
  formatVersion: number
  createdAt: number
  applicationId: string
  cardCount: number
  boardCount: number
  trashItemCount: number
  mediaFileCount: number
}

export interface BackupSummary {
  path: string
  timestamp: string
  createdAt: number
  cardCount: number
  boardCount: number
  trashCount: number
  mediaCount: number
  format: BackupFormat
  warnings: string[]
}

export interface BackupOperationResult {
  success: boolean
  stage?: BackupFailureStage
  error?: string
  path?: string
  safetyBackupPath?: string
  summary?: BackupSummary
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

async function renameForReplacement(source: string, destination: string): Promise<void> {
  const retryDelays = [0, 25, 75, 150, 300]
  let lastError: unknown
  for (const delay of retryDelays) {
    if (delay > 0) await new Promise(resolveDelay => setTimeout(resolveDelay, delay))
    try {
      await rename(source, destination)
      return
    } catch (error) {
      lastError = error
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(errorCode(error) ?? '')) throw error
    }
  }
  throw lastError
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function assertWithinRoot(root: string, candidate: string): void {
  const rootPath = resolve(root)
  const candidatePath = resolve(candidate)
  const rel = relative(rootPath, candidatePath)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path escapes backup root: ${candidate}`)
  }
}

function assertSafeFilename(filename: string, directory: string): void {
  if (!filename || filename !== basename(filename) || filename.includes('..')) {
    throw new Error(`Unsafe filename in ${directory}: ${filename}`)
  }
  if (directory === 'media') {
    if (!isMediaFilenameSafe(filename)) throw new Error(`Unsafe media filename: ${filename}`)
    return
  }
  if (!filename.endsWith('.json')) throw new Error(`Unexpected file in ${directory}: ${filename}`)
}

async function listSafeFiles(root: string, directory: string): Promise<string[]> {
  const dirPath = join(root, directory)
  assertWithinRoot(root, dirPath)
  if (!(await pathExists(dirPath))) return []
  const dirStat = await lstat(dirPath)
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) {
    throw new Error(`${directory} must be a regular directory`)
  }

  const entries = await readdir(dirPath, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    assertSafeFilename(entry.name, directory)
    const entryPath = join(dirPath, entry.name)
    assertWithinRoot(root, entryPath)
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error(`Nested or linked entry is not allowed: ${directory}/${entry.name}`)
    }
    files.push(entry.name)
  }
  return files.sort()
}

async function parseJSONFile(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch (error) {
    const wrapped = new Error(`Invalid ${label}: ${errorMessage(error)}`)
    Object.defineProperty(wrapped, 'cause', { value: error })
    throw wrapped
  }
}

function timestampFromPath(path: string, fallback: number): string {
  const name = basename(path)
  const match = name.match(/^(\d+)/)
  return match?.[1] ?? String(fallback)
}

export async function validateBackupFolder(root: string): Promise<BackupSummary> {
  const rootPath = resolve(root)
  const rootStat = await stat(rootPath).catch(() => null)
  if (!rootStat?.isDirectory()) throw new Error('Selected backup path is not a directory')
  if ((await lstat(rootPath)).isSymbolicLink()) throw new Error('Backup root cannot be a symbolic link')

  const manifestPath = join(rootPath, MANIFEST_FILENAME)
  const hasManifest = await pathExists(manifestPath)
  const format: BackupFormat = hasManifest ? 'current' : 'legacy'
  const warnings: string[] = []

  for (const required of ['cards', 'boards', 'trash']) {
    if (!(await pathExists(join(rootPath, required)))) {
      throw new Error(`Missing required directory: ${required}`)
    }
  }

  const cards = await listSafeFiles(rootPath, 'cards')
  const boards = await listSafeFiles(rootPath, 'boards')
  const trash = await listSafeFiles(rootPath, 'trash')
  const media = await listSafeFiles(rootPath, 'media')

  await Promise.all(cards.map(file => parseJSONFile(join(rootPath, 'cards', file), `card JSON ${file}`)))
  await Promise.all(trash.map(file => parseJSONFile(join(rootPath, 'trash', file), `trash JSON ${file}`)))
  await Promise.all(boards.map(file => parseJSONFile(join(rootPath, 'boards', file), `board JSON ${file}`)))

  const boardFiles = boards.filter(file => file !== '_manifest.json')
  const boardManifestPath = join(rootPath, 'boards', '_manifest.json')
  if (await pathExists(boardManifestPath)) {
    const parsed = await parseJSONFile(boardManifestPath, 'board manifest')
    const manifest = parsed as { boards?: unknown }
    if (!Array.isArray(manifest.boards)) throw new Error('Board manifest must contain a boards array')
    for (const item of manifest.boards) {
      if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') {
        throw new Error('Board manifest contains an invalid board reference')
      }
      const id = (item as { id: string }).id
      assertSafeFilename(`${id}.json`, 'boards')
      if (!boardFiles.includes(`${id}.json`)) {
        throw new Error(`Board manifest references missing file: ${id}.json`)
      }
    }
  } else if (boardFiles.length > 0) {
    throw new Error('Missing boards/_manifest.json')
  }

  const metadataPath = join(rootPath, METADATA_FILENAME)
  if (await pathExists(metadataPath)) await parseJSONFile(metadataPath, 'workspace metadata')

  let createdAt = Number(timestampFromPath(rootPath, Date.now()))
  if (!Number.isFinite(createdAt)) createdAt = (await stat(rootPath)).mtimeMs

  if (hasManifest) {
    const parsed = await parseJSONFile(manifestPath, 'backup manifest')
    if (!parsed || typeof parsed !== 'object') throw new Error('Backup manifest must be an object')
    const manifest = parsed as Partial<BackupManifest>
    if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
      throw new Error(`Unsupported backup format version: ${String(manifest.formatVersion)}`)
    }
    if (manifest.applicationId !== BACKUP_APP_ID) throw new Error('Backup application identifier does not match')
    if (typeof manifest.createdAt !== 'number') throw new Error('Backup manifest creation time is invalid')
    const expected = {
      cardCount: cards.length,
      boardCount: boardFiles.length,
      trashItemCount: trash.length,
      mediaFileCount: media.length,
    }
    for (const [key, count] of Object.entries(expected)) {
      if (manifest[key as keyof BackupManifest] !== count) {
        throw new Error(`Backup manifest ${key} does not match folder contents`)
      }
    }
    if (!(await pathExists(metadataPath))) throw new Error(`Missing required file: ${METADATA_FILENAME}`)
    if (!(await pathExists(join(rootPath, 'media')))) throw new Error('Missing required directory: media')
    createdAt = manifest.createdAt
  } else {
    if (!(await pathExists(join(rootPath, 'media')))) warnings.push('Legacy backup has no media directory')
    if (!(await pathExists(metadataPath))) warnings.push('Legacy backup has no workspace metadata')
  }

  return {
    path: rootPath,
    timestamp: timestampFromPath(rootPath, createdAt),
    createdAt,
    cardCount: cards.length,
    boardCount: boardFiles.length,
    trashCount: trash.length,
    mediaCount: media.length,
    format,
    warnings,
  }
}

async function copyDirectory(source: string, destination: string, allowMissing = true): Promise<void> {
  await mkdir(destination, { recursive: true })
  if (!(await pathExists(source))) {
    if (allowMissing) return
    throw new Error(`Missing source directory: ${source}`)
  }
  const entries = await readdir(source, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isFile()) throw new Error(`Cannot copy linked or nested entry: ${entry.name}`)
    await copyFile(join(source, entry.name), join(destination, entry.name))
  }
}

async function uniqueDirectory(parent: string, timestamp: number, numericOnly: boolean): Promise<string> {
  await mkdir(parent, { recursive: true })
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const name = numericOnly ? String(timestamp + attempt) : `${timestamp}${attempt ? `-${attempt}` : ''}`
    const candidate = join(parent, name)
    if (!(await pathExists(candidate))) {
      await mkdir(candidate, { recursive: false })
      return candidate
    }
  }
  throw new Error('Unable to allocate a unique backup directory')
}

async function writeManifest(backupPath: string, createdAt: number): Promise<BackupSummary> {
  const cards = await listSafeFiles(backupPath, 'cards')
  const boards = (await listSafeFiles(backupPath, 'boards')).filter(file => file !== '_manifest.json')
  const trash = await listSafeFiles(backupPath, 'trash')
  const media = await listSafeFiles(backupPath, 'media')
  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    applicationId: BACKUP_APP_ID,
    cardCount: cards.length,
    boardCount: boards.length,
    trashItemCount: trash.length,
    mediaFileCount: media.length,
  }
  await writeFile(join(backupPath, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2), 'utf8')
  return validateBackupFolder(backupPath)
}

async function populateBackup(workspacePath: string, backupPath: string, createdAt: number): Promise<BackupSummary> {
  for (const directory of DATA_DIRECTORIES) {
    await copyDirectory(join(workspacePath, directory), join(backupPath, directory))
  }

  const metadataSource = join(workspacePath, METADATA_FILENAME)
  if (await pathExists(metadataSource)) {
    await copyFile(metadataSource, join(backupPath, METADATA_FILENAME))
  } else {
    const cardCount = (await listSafeFiles(backupPath, 'cards')).length
    const boardCount = (await listSafeFiles(backupPath, 'boards')).filter(file => file !== '_manifest.json').length
    await writeFile(join(backupPath, METADATA_FILENAME), JSON.stringify({
      version: 1,
      cardCount,
      boardCount,
      lastModified: createdAt,
    }, null, 2), 'utf8')
  }
  return writeManifest(backupPath, createdAt)
}

export async function createAutomaticBackup(
  workspacePath: string,
  now = Date.now(),
  preservePath?: string,
): Promise<BackupOperationResult> {
  try {
    const backupBase = join(workspacePath, '.backups')
    const backupPath = await uniqueDirectory(backupBase, now, true)
    try {
      const summary = await populateBackup(workspacePath, backupPath, now)
      const entries = await readdir(backupBase, { withFileTypes: true })
      const directories = entries
        .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map(entry => entry.name)
        .sort((a, b) => Number(a) - Number(b))
      while (directories.length > MAX_AUTOMATIC_BACKUPS) {
        const removableIndex = directories.findIndex(name => resolve(join(backupBase, name)) !== resolve(preservePath ?? ''))
        if (removableIndex === -1) break
        const [oldest] = directories.splice(removableIndex, 1)
        await rm(join(backupBase, oldest), { recursive: true, force: true })
      }
      return { success: true, path: backupPath, summary }
    } catch (error) {
      await rm(backupPath, { recursive: true, force: true })
      throw error
    }
  } catch (error) {
    return { success: false, stage: 'safety-backup', error: errorMessage(error) }
  }
}

export async function listAutomaticBackups(workspacePath: string): Promise<BackupSummary[]> {
  const backupBase = join(workspacePath, '.backups')
  if (!(await pathExists(backupBase))) return []
  const entries = await readdir(backupBase, { withFileTypes: true })
  const summaries = await Promise.all(entries
    .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map(async entry => validateBackupFolder(join(backupBase, entry.name)).catch(() => null)))
  return summaries
    .filter((summary): summary is BackupSummary => summary !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function exportCurrentWorkspace(workspacePath: string, downloadsPath: string, now = Date.now()): Promise<BackupOperationResult> {
  const parent = join(downloadsPath, BACKUP_DIRECTORY_NAME)
  let exportPath: string | undefined
  try {
    exportPath = await uniqueDirectory(parent, now, false)
    const summary = await populateBackup(workspacePath, exportPath, now)
    return { success: true, path: exportPath, summary }
  } catch (error) {
    if (exportPath) await rm(exportPath, { recursive: true, force: true }).catch(() => undefined)
    return { success: false, stage: 'export', error: errorMessage(error), path: exportPath ?? parent }
  }
}

export async function exportExistingBackup(sourcePath: string, downloadsPath: string, now = Date.now()): Promise<BackupOperationResult> {
  const parent = join(downloadsPath, BACKUP_DIRECTORY_NAME)
  let exportPath: string | undefined
  try {
    const sourceSummary = await validateBackupFolder(sourcePath)
    exportPath = await uniqueDirectory(parent, now, false)
    for (const directory of DATA_DIRECTORIES) {
      await copyDirectory(join(sourcePath, directory), join(exportPath, directory))
    }
    for (const filename of [METADATA_FILENAME, MANIFEST_FILENAME]) {
      const source = join(sourcePath, filename)
      if (await pathExists(source)) await copyFile(source, join(exportPath, filename))
    }
    if (sourceSummary.format === 'legacy' && !(await pathExists(join(exportPath, METADATA_FILENAME)))) {
      await writeFile(join(exportPath, METADATA_FILENAME), JSON.stringify({
        version: 1,
        cardCount: sourceSummary.cardCount,
        boardCount: sourceSummary.boardCount,
        lastModified: sourceSummary.createdAt,
      }, null, 2), 'utf8')
    }
    const summary = sourceSummary.format === 'current'
      ? await validateBackupFolder(exportPath)
      : await writeManifest(exportPath, sourceSummary.createdAt)
    return { success: true, path: exportPath, summary }
  } catch (error) {
    if (exportPath) await rm(exportPath, { recursive: true, force: true }).catch(() => undefined)
    return { success: false, stage: 'export', error: errorMessage(error), path: exportPath ?? parent }
  }
}

async function copyBackupForStaging(sourcePath: string, stagePath: string): Promise<void> {
  await mkdir(stagePath, { recursive: false })
  for (const directory of DATA_DIRECTORIES) {
    await copyDirectory(join(sourcePath, directory), join(stagePath, directory))
  }
  for (const filename of [METADATA_FILENAME, MANIFEST_FILENAME]) {
    const source = join(sourcePath, filename)
    if (await pathExists(source)) await copyFile(source, join(stagePath, filename))
  }
  if (!(await pathExists(join(stagePath, METADATA_FILENAME)))) {
    const cardCount = (await listSafeFiles(stagePath, 'cards')).length
    const boardCount = (await listSafeFiles(stagePath, 'boards')).filter(file => file !== '_manifest.json').length
    await writeFile(join(stagePath, METADATA_FILENAME), JSON.stringify({
      version: 1,
      cardCount,
      boardCount,
      lastModified: Date.now(),
    }, null, 2), 'utf8')
  }
}

export async function restoreBackup(workspacePath: string, sourcePath: string): Promise<BackupOperationResult> {
  let sourceSummary: BackupSummary
  try {
    sourceSummary = await validateBackupFolder(sourcePath)
  } catch (error) {
    return { success: false, stage: 'validation', error: errorMessage(error) }
  }

  const safety = await createAutomaticBackup(workspacePath, Date.now(), sourcePath)
  if (!safety.success || !safety.path) {
    return { ...safety, stage: 'safety-backup' }
  }

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const stagePath = join(workspacePath, `.backup-restore-stage-${nonce}`)
  const rollbackPath = join(workspacePath, `.backup-restore-rollback-${nonce}`)
  try {
    await copyBackupForStaging(sourcePath, stagePath)
    await validateBackupFolder(stagePath)
  } catch (error) {
    await rm(stagePath, { recursive: true, force: true }).catch(() => undefined)
    return {
      success: false,
      stage: 'staging',
      error: errorMessage(error),
      safetyBackupPath: safety.path,
    }
  }

  await mkdir(rollbackPath, { recursive: false })
  const movedExisting: string[] = []
  const installed: string[] = []
  try {
    for (const name of [...DATA_DIRECTORIES, METADATA_FILENAME]) {
      const current = join(workspacePath, name)
      if (await pathExists(current)) {
        await renameForReplacement(current, join(rollbackPath, name))
        movedExisting.push(name)
      }
    }
    for (const name of [...DATA_DIRECTORIES, METADATA_FILENAME]) {
      await renameForReplacement(join(stagePath, name), join(workspacePath, name))
      installed.push(name)
    }
    await validateBackupFolder(workspacePath)
    await rm(stagePath, { recursive: true, force: true })
    await rm(rollbackPath, { recursive: true, force: true })
    return {
      success: true,
      path: sourcePath,
      safetyBackupPath: safety.path,
      summary: sourceSummary,
    }
  } catch (error) {
    for (const name of installed.reverse()) {
      await rm(join(workspacePath, name), { recursive: true, force: true }).catch(() => undefined)
    }
    for (const name of movedExisting.reverse()) {
      const rollbackItem = join(rollbackPath, name)
      if (await pathExists(rollbackItem)) {
        await renameForReplacement(rollbackItem, join(workspacePath, name)).catch(() => undefined)
      }
    }
    await rm(stagePath, { recursive: true, force: true }).catch(() => undefined)
    await rm(rollbackPath, { recursive: true, force: true }).catch(() => undefined)
    return {
      success: false,
      stage: 'replacement',
      error: errorMessage(error),
      safetyBackupPath: safety.path,
    }
  }
}

export function recentBackupPath(workspacePath: string, timestamp: string): string {
  if (!/^\d+$/.test(timestamp)) throw new Error('Invalid backup timestamp')
  return join(workspacePath, '.backups', timestamp)
}

export function intendedExportDirectory(downloadsPath: string): string {
  return join(downloadsPath, BACKUP_DIRECTORY_NAME)
}

export function backupParent(path: string): string {
  return dirname(path)
}
