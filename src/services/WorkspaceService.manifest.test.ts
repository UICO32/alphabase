import { describe, expect, it } from 'vitest'
import { setFSAdapter } from '../utils/workspace/fs'
import { WorkspaceService } from './WorkspaceService'

interface MemoryFS {
  files: Map<string, string>
  dirs: Set<string>
}

function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function parentDir(path: string): string {
  const normalized = normalize(path)
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? normalized : normalized.slice(0, index)
}

function baseName(path: string): string {
  const normalized = normalize(path)
  return normalized.slice(normalized.lastIndexOf('/') + 1)
}

function installAdapter(mem: MemoryFS) {
  setFSAdapter({
    readFile: async (path) => {
      const value = mem.files.get(normalize(path))
      if (value === undefined) throw new Error(`ENOENT: ${path}`)
      return new TextEncoder().encode(value)
    },
    writeFile: async (path, data) => {
      mem.files.set(normalize(path), typeof data === 'string' ? data : new TextDecoder().decode(data))
    },
    deleteFile: async (path) => { mem.files.delete(normalize(path)) },
    readdir: async (path) => {
      const dir = normalize(path)
      return [...mem.files.keys()].filter(file => parentDir(file) === dir).map(baseName)
    },
    readDirFiles: async () => null,
    mkdir: async (path) => { mem.dirs.add(normalize(path)) },
    stat: async (path) => {
      const file = normalize(path)
      const isDirectory = mem.dirs.has(file) && !mem.files.has(file)
      if (!isDirectory && !mem.files.has(file)) throw new Error(`ENOENT: ${path}`)
      const size = mem.files.get(file)?.length ?? 0
      return { isDirectory, size, mtimeMs: 1000 + size }
    },
    exists: async (path) => mem.dirs.has(normalize(path)) || mem.files.has(normalize(path)),
    rename: async (from, to) => {
      const value = mem.files.get(normalize(from))
      if (value === undefined) throw new Error(`ENOENT: ${from}`)
      mem.files.delete(normalize(from))
      mem.files.set(normalize(to), value)
    },
    rmdir: async (path) => { mem.dirs.delete(normalize(path)) },
  })
}

function setupWorkspace(files: Record<string, string>): MemoryFS {
  const mem: MemoryFS = { files: new Map(), dirs: new Set(['D:/ws', 'D:/ws/boards']) }
  for (const [path, content] of Object.entries(files)) {
    mem.files.set(normalize(path), content)
  }
  installAdapter(mem)
  return mem
}

function createService(): WorkspaceService {
  const service = new WorkspaceService()
  service.setWorkspacePath('D:/ws')
  return service
}

describe('WorkspaceService.loadManifest', () => {
  it('rebuilds the manifest from existing board snapshots instead of wiping them', async () => {
    const mem = setupWorkspace({
      'D:/ws/boards/board-a.json': '{"version":2,"nodes":[],"edges":[]}',
      'D:/ws/boards/board-b.json': '{"version":2,"nodes":[],"edges":[]}',
      'D:/ws/boards/notes.txt': 'ignore me',
    })

    const manifest = await createService().loadManifest()

    expect(manifest.boards.map(board => board.id)).toEqual(['board-a', 'board-b'])
    const written = JSON.parse(mem.files.get('D:/ws/boards/_manifest.json') ?? '{}')
    expect(written.boards.map((board: { id: string }) => board.id)).toEqual(['board-a', 'board-b'])
  })

  it('writes an empty manifest only when there is no board snapshot at all', async () => {
    const mem = setupWorkspace({})

    const manifest = await createService().loadManifest()

    expect(manifest.boards).toEqual([])
    expect(mem.files.has('D:/ws/boards/_manifest.json')).toBe(true)
  })

  it('keeps an existing manifest untouched', async () => {
    const existing = {
      boards: [{ id: 'board-x', name: '我的画板', createdAt: 1, updatedAt: 2 }],
    }
    const raw = JSON.stringify(existing)
    const mem = setupWorkspace({
      'D:/ws/boards/_manifest.json': raw,
      'D:/ws/boards/board-x.json': '{"version":2,"nodes":[],"edges":[]}',
    })

    const manifest = await createService().loadManifest()

    expect(manifest).toEqual(existing)
    expect(mem.files.get('D:/ws/boards/_manifest.json')).toBe(raw)
  })
})
