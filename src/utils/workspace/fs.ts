/**
 * Filesystem abstraction layer.
 *
 * Supports two modes:
 * - Electron: uses IPC to communicate with main process
 * - Web: uses File System Access API with IndexedDB fallback
 */

export interface FSAdapter {
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array | string): Promise<void>
  deleteFile(path: string): Promise<void>
  readdir(path: string): Promise<string[]>
  mkdir(path: string): Promise<void>
  stat(path: string): Promise<{ isDirectory: boolean; size: number; mtimeMs: number }>
  exists(path: string): Promise<boolean>
  rename(oldPath: string, newPath: string): Promise<void>
}

let adapter: FSAdapter | null = null

export function setFSAdapter(a: FSAdapter) {
  adapter = a
}

export function getFSAdapter(): FSAdapter {
  if (!adapter) throw new Error('FSAdapter not set. Call setFSAdapter() first.')
  return adapter
}

export async function readFile(path: string): Promise<string> {
  const data = await getFSAdapter().readFile(path)
  return new TextDecoder().decode(data)
}

export async function writeFile(path: string, data: string): Promise<void> {
  await getFSAdapter().writeFile(path, data)
}

export async function deleteFile(path: string): Promise<void> {
  await getFSAdapter().deleteFile(path)
}

export async function readdir(path: string): Promise<string[]> {
  return await getFSAdapter().readdir(path)
}

export async function mkdir(path: string): Promise<void> {
  await getFSAdapter().mkdir(path)
}

export async function stat(path: string): Promise<{ isDirectory: boolean; size: number; mtimeMs: number }> {
  return await getFSAdapter().stat(path)
}

export async function exists(path: string): Promise<boolean> {
  return await getFSAdapter().exists(path)
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
  await getFSAdapter().rename(oldPath, newPath)
}

export async function readJSON<T>(path: string): Promise<T> {
  const content = await readFile(path)
  return JSON.parse(content) as T
}

export async function writeJSON(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2))
}
