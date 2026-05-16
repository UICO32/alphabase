import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'heptabase-backup'
const DB_VERSION = 1
const MAX_BACKUPS = 10

interface BackupEntry {
  id: string
  name: string
  createdAt: number
  data: Record<string, unknown>
}

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('backups')) {
          const store = db.createObjectStore('backups', { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

export async function createBackup(name: string, data: Record<string, unknown>): Promise<string> {
  const db = await getDB()
  const id = `backup_${Date.now()}`
  const entry: BackupEntry = { id, name, createdAt: Date.now(), data }
  await db.add('backups', entry)

  // Trim old backups
  const count = await db.count('backups')
  if (count > MAX_BACKUPS) {
    const cursor = await db.transaction('backups', 'readwrite').store.index('createdAt').openCursor()
    let toDelete = count - MAX_BACKUPS
    while (cursor && toDelete > 0) {
      cursor.delete()
      toDelete--
      cursor.continue()
    }
  }

  return id
}

export async function listBackups(): Promise<Omit<BackupEntry, 'data'>[]> {
  const db = await getDB()
  const entries = await db.getAll('backups')
  return entries.map(({ data, ...rest }) => rest) as Omit<BackupEntry, 'data'>[]
}

export async function restoreBackup(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDB()
  const entry = await db.get('backups', id) as BackupEntry | undefined
  return entry?.data ?? null
}

export async function deleteBackup(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('backups', id)
}

// --- File system backup ---

const MAX_FILE_BACKUPS = 10

export async function createFileSystemBackup(workspacePath: string): Promise<string | null> {
  try {
    const timestamp = Date.now().toString()
    const backupDir = `${workspacePath}/.backup/${timestamp}`
    const { mkdir, exists, readdir, writeFile: writeF, readFile: readF, deleteFile: delF, rmdir } = await import('./workspace/fs')

    await mkdir(backupDir)

    // Copy cards/
    const cardsDir = `${workspacePath}/cards`
    if (await exists(cardsDir)) {
      await mkdir(`${backupDir}/cards`)
      const cardFiles = await readdir(cardsDir)
      for (const file of cardFiles) {
        if (!file.endsWith('.json')) continue
        const content = await readF(`${cardsDir}/${file}`)
        await writeF(`${backupDir}/cards/${file}`, content)
      }
    }

    // Copy boards/
    const boardsDir = `${workspacePath}/boards`
    if (await exists(boardsDir)) {
      await mkdir(`${backupDir}/boards`)
      const boardFiles = await readdir(boardsDir)
      for (const file of boardFiles) {
        if (!file.endsWith('.json')) continue
        const content = await readF(`${boardsDir}/${file}`)
        await writeF(`${backupDir}/boards/${file}`, content)
      }
    }

    // Copy trash/
    const trashDir = `${workspacePath}/trash`
    if (await exists(trashDir)) {
      await mkdir(`${backupDir}/trash`)
      const trashFiles = await readdir(trashDir)
      for (const file of trashFiles) {
        if (!file.endsWith('.json')) continue
        const content = await readF(`${trashDir}/${file}`)
        await writeF(`${backupDir}/trash/${file}`, content)
      }
    }

    // Prune old backups, keep most recent MAX_FILE_BACKUPS
    const backupParent = `${workspacePath}/.backup`
    const allBackups = (await readdir(backupParent))
      .filter(name => /^\d+$/.test(name))
      .sort()

    while (allBackups.length > MAX_FILE_BACKUPS) {
      const old = allBackups.shift()!
      const oldDir = `${backupParent}/${old}`
      const oldCardsDir = `${oldDir}/cards`
      if (await exists(oldCardsDir)) {
        const oldCardFiles = await readdir(oldCardsDir)
        for (const f of oldCardFiles) await delF(`${oldCardsDir}/${f}`)
        await rmdir(oldCardsDir).catch(() => {})
      }
      const oldBoardsDir = `${oldDir}/boards`
      if (await exists(oldBoardsDir)) {
        const oldBoardFiles = await readdir(oldBoardsDir)
        for (const f of oldBoardFiles) await delF(`${oldBoardsDir}/${f}`)
        await rmdir(oldBoardsDir).catch(() => {})
      }
      const oldTrashDir = `${oldDir}/trash`
      if (await exists(oldTrashDir)) {
        const oldTrashFiles = await readdir(oldTrashDir)
        for (const f of oldTrashFiles) await delF(`${oldTrashDir}/${f}`)
        await rmdir(oldTrashDir).catch(() => {})
      }
      await rmdir(oldDir).catch(() => {})
    }

    return backupDir
  } catch (e) {
    console.warn('File system backup failed:', e)
    return null
  }
}
