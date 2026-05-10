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
