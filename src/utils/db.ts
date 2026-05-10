import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'heptabase-db'
const DB_VERSION = 1

interface HeptabaseDB {
  canvases: { key: string; value: unknown }
  cards: { key: string; value: unknown }
  settings: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<HeptabaseDB>> | null = null

export function getDB(): Promise<IDBPDatabase<HeptabaseDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HeptabaseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('canvases')) {
          db.createObjectStore('canvases')
        }
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' })
          cardStore.createIndex('createdAt', 'createdAt')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
      },
    })
  }
  return dbPromise
}

export async function saveCanvas(key: string, snapshot: unknown): Promise<void> {
  const db = await getDB()
  await db.put('canvases', snapshot, key)
}

export async function loadCanvas(key: string): Promise<unknown | undefined> {
  const db = await getDB()
  return db.get('canvases', key)
}

export async function saveCard(card: { id: string; [key: string]: unknown }): Promise<void> {
  const db = await getDB()
  await db.put('cards', card)
}

export async function loadCard(id: string): Promise<unknown | undefined> {
  const db = await getDB()
  return db.get('cards', id)
}

export async function loadAllCards(): Promise<unknown[]> {
  const db = await getDB()
  return db.getAll('cards')
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('cards', id)
}

export async function clearAllCards(): Promise<void> {
  const db = await getDB()
  await db.clear('cards')
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', value, key)
}

export async function loadSetting(key: string): Promise<unknown | undefined> {
  const db = await getDB()
  return db.get('settings', key)
}

export async function migrateFromLocalStorage(): Promise<void> {
  const db = await getDB()
  
  const possibleKeys = ['heptabase-v2-store', 'store', 'heptabase-store']
  for (const key of possibleKeys) {
    const oldCanvas = localStorage.getItem(key)
    if (oldCanvas) {
      try {
        const snapshot = JSON.parse(oldCanvas)
        await db.put('canvases', snapshot, 'current')
        console.log(`Migrated canvas from localStorage (${key}) to IndexedDB`)
        break
      } catch (e) {
        console.warn(`Failed to migrate canvas from ${key}:`, e)
      }
    }
  }
  
  const possibleCardKeys = ['hepta-global-cards', 'global-cards', 'cards']
  for (const key of possibleCardKeys) {
    const oldCards = localStorage.getItem(key)
    if (oldCards) {
      try {
        const cards = JSON.parse(oldCards)
        const tx = db.transaction('cards', 'readwrite')
        for (const card of Object.values(cards) as { id: string }[]) {
          await tx.store.put(card)
        }
        await tx.done
        console.log(`Migrated cards from localStorage (${key}) to IndexedDB`)
        break
      } catch (e) {
        console.warn(`Failed to migrate cards from ${key}:`, e)
      }
    }
  }
}
