import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  createAutomaticBackup,
  exportCurrentWorkspace,
  restoreBackup,
  validateBackupFolder,
} from './backupService'

const roots: string[] = []

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'abase-backup-'))
  roots.push(root)
  return root
}

async function createWorkspace(root: string): Promise<string> {
  const workspace = join(root, 'workspace')
  for (const directory of ['cards', 'boards', 'trash', 'media']) {
    await mkdir(join(workspace, directory), { recursive: true })
  }
  await writeFile(join(workspace, 'cards', 'card-1.json'), JSON.stringify({ id: 'card-1' }))
  await writeFile(join(workspace, 'boards', 'board-1.json'), JSON.stringify({ version: 2 }))
  await writeFile(join(workspace, 'boards', '_manifest.json'), JSON.stringify({ boards: [{ id: 'board-1' }] }))
  await writeFile(join(workspace, 'trash', 'old.trash.json'), JSON.stringify({ id: 'trash-1' }))
  await writeFile(join(workspace, 'media', 'photo.png'), new Uint8Array([0, 1, 2, 255]))
  await writeFile(join(workspace, '_metadata.json'), JSON.stringify({ version: 1, cardCount: 1, boardCount: 1, lastModified: 1 }))
  return workspace
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('backup service', () => {
  it('creates and validates a complete automatic backup including binary media and metadata', async () => {
    const root = await temporaryRoot()
    const workspace = await createWorkspace(root)

    const result = await createAutomaticBackup(workspace, 1_700_000_000_000)

    expect(result).toMatchObject({
      success: true,
      summary: { cardCount: 1, boardCount: 1, trashCount: 1, mediaCount: 1, format: 'current' },
    })
    const manifest = JSON.parse(await readFile(join(result.path!, 'backup-manifest.json'), 'utf8'))
    expect(manifest).toEqual({
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: 1_700_000_000_000,
      applicationId: BACKUP_APP_ID,
      cardCount: 1,
      boardCount: 1,
      trashItemCount: 1,
      mediaFileCount: 1,
    })
    expect([...await readFile(join(result.path!, 'media', 'photo.png'))]).toEqual([0, 1, 2, 255])
  })

  it('recognizes a structurally valid legacy backup and warns about missing media and metadata', async () => {
    const root = await temporaryRoot()
    const legacy = join(root, '1700000000000')
    await mkdir(join(legacy, 'cards'), { recursive: true })
    await mkdir(join(legacy, 'boards'), { recursive: true })
    await mkdir(join(legacy, 'trash'), { recursive: true })
    await writeFile(join(legacy, 'cards', 'card.json'), JSON.stringify({ id: 'card' }))
    await writeFile(join(legacy, 'boards', '_manifest.json'), JSON.stringify({ boards: [] }))

    const summary = await validateBackupFolder(legacy)

    expect(summary.format).toBe('legacy')
    expect(summary.warnings).toEqual(expect.arrayContaining([
      'Legacy backup has no media directory',
      'Legacy backup has no workspace metadata',
    ]))
  })

  it('rejects invalid JSON, missing board references, and manifest count mismatches', async () => {
    const root = await temporaryRoot()
    const workspace = await createWorkspace(root)
    const result = await createAutomaticBackup(workspace, 1_700_000_000_001)
    await writeFile(join(result.path!, 'cards', 'card-1.json'), '{broken')
    await expect(validateBackupFolder(result.path!)).rejects.toThrow('Invalid card JSON')

    await writeFile(join(result.path!, 'cards', 'card-1.json'), JSON.stringify({ id: 'card-1' }))
    await writeFile(join(result.path!, 'boards', '_manifest.json'), JSON.stringify({ boards: [{ id: 'missing' }] }))
    await expect(validateBackupFolder(result.path!)).rejects.toThrow('references missing file')

    await writeFile(join(result.path!, 'boards', '_manifest.json'), JSON.stringify({ boards: [{ id: 'board-1' }] }))
    const manifestPath = join(result.path!, 'backup-manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.cardCount = 99
    await writeFile(manifestPath, JSON.stringify(manifest))
    await expect(validateBackupFolder(result.path!)).rejects.toThrow('cardCount does not match')
  })

  it('exports to a collision-safe Downloads/Abase Backups directory', async () => {
    const root = await temporaryRoot()
    const workspace = await createWorkspace(root)
    const downloads = join(root, 'Downloads')

    const first = await exportCurrentWorkspace(workspace, downloads, 1_700_000_000_002)
    const second = await exportCurrentWorkspace(workspace, downloads, 1_700_000_000_002)

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(first.path).toBe(join(downloads, 'Abase Backups', '1700000000002'))
    expect(second.path).toBe(join(downloads, 'Abase Backups', '1700000000002-1'))
  })

  it('creates a safety backup before replacing every workspace data area', async () => {
    const root = await temporaryRoot()
    const workspace = await createWorkspace(root)
    const sourceResult = await createAutomaticBackup(workspace, 1_700_000_000_003)
    await writeFile(join(sourceResult.path!, 'cards', 'card-1.json'), JSON.stringify({ id: 'restored' }))
    const manifestPath = join(sourceResult.path!, 'backup-manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    await writeFile(manifestPath, JSON.stringify(manifest))
    await writeFile(join(workspace, 'cards', 'card-1.json'), JSON.stringify({ id: 'current' }))

    const restored = await restoreBackup(workspace, sourceResult.path!)

    expect(restored.success).toBe(true)
    expect(restored.safetyBackupPath).toBeTruthy()
    expect(JSON.parse(await readFile(join(workspace, 'cards', 'card-1.json'), 'utf8'))).toEqual({ id: 'restored' })
    expect(JSON.parse(await readFile(join(restored.safetyBackupPath!, 'cards', 'card-1.json'), 'utf8'))).toEqual({ id: 'current' })
  })

  it('round-trips an exported backup through external replacement', async () => {
    const root = await temporaryRoot()
    const workspace = await createWorkspace(root)
    const exported = await exportCurrentWorkspace(workspace, join(root, 'Downloads'), 1_700_000_000_004)
    expect(exported.success).toBe(true)

    await writeFile(join(workspace, 'cards', 'card-1.json'), JSON.stringify({ id: 'changed-after-export' }))
    const restored = await restoreBackup(workspace, exported.path!)

    expect(restored).toMatchObject({ success: true, path: exported.path })
    expect(JSON.parse(await readFile(join(workspace, 'cards', 'card-1.json'), 'utf8'))).toEqual({ id: 'card-1' })
    expect(JSON.parse(await readFile(join(restored.safetyBackupPath!, 'cards', 'card-1.json'), 'utf8')))
      .toEqual({ id: 'changed-after-export' })
  })

  it('does not mutate the workspace when external validation fails', async () => {
    const root = await temporaryRoot()
    const workspace = await createWorkspace(root)
    const invalid = join(root, 'invalid')
    await mkdir(invalid)

    const result = await restoreBackup(workspace, invalid)

    expect(result).toMatchObject({ success: false, stage: 'validation' })
    expect(JSON.parse(await readFile(join(workspace, 'cards', 'card-1.json'), 'utf8'))).toEqual({ id: 'card-1' })
  })
})
