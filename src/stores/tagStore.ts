import { create } from 'zustand'
import { useCardStore } from './cardStore'
import { useWorkspaceStore } from './workspaceStore'
import { readJSON, writeJSON, exists, mkdir } from '../utils/workspace/fs'

export interface TagEntity {
  name: string
  createdAt: number
  flomoSynced?: boolean
  color?: string
}

interface TagStore {
  tags: Record<string, TagEntity>
  isLoaded: boolean

  loadState: () => Promise<void>
  saveState: () => Promise<void>

  ensureTag: (name: string, opts?: { flomoSynced?: boolean }) => void
  ensureTags: (names: string[], opts?: { flomoSynced?: boolean }) => void
  getTagCounts: () => Record<string, number>
  getTagsSortedByUsage: () => { name: string; count: number; flomoSynced?: boolean }[]

  renameTag: (oldName: string, newName: string) => void
  deleteTag: (name: string) => void
}

function workspaceTagsPath(): string | null {
  const ws = useWorkspaceStore.getState().currentWorkspace
  return ws?.path ? `${ws.path}/tags.json` : null
}

function walkInlineContent(
  content: unknown[],
  mutator: (node: Record<string, unknown>) => Record<string, unknown> | false,
): void {
  for (let i = 0; i < content.length; i++) {
    const node = content[i] as Record<string, unknown>
    if (!node || typeof node !== 'object') continue
    if (node.type === 'tag') {
      const replaced = mutator(node)
      if (replaced !== false) {
        content[i] = replaced
      }
    } else if (Array.isArray(node.content)) {
      walkInlineContent(node.content as unknown[], mutator)
    }
  }
}

function walkBlocks(
  blocks: Record<string, unknown>[],
  mutator: (node: Record<string, unknown>) => Record<string, unknown> | false,
): void {
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (Array.isArray(block.content)) {
      walkInlineContent(block.content as unknown[], mutator)
    }
    if (Array.isArray(block.children)) {
      walkBlocks(block.children as Record<string, unknown>[], mutator)
    }
    if (Array.isArray(block.rows)) {
      for (const row of block.rows as Record<string, unknown>[]) {
        if (row && Array.isArray(row.cells)) {
          for (const cell of row.cells as unknown[]) {
            if (Array.isArray(cell)) {
              walkInlineContent(cell as unknown[], mutator)
            } else if (cell && Array.isArray((cell as Record<string, unknown>).content)) {
              walkInlineContent(
                (cell as Record<string, unknown>).content as unknown[],
                mutator,
              )
            }
          }
        }
      }
    }
  }
}

export const useTagStore = create<TagStore>()((set, get) => ({
  tags: {},
  isLoaded: false,

  loadState: async () => {
    const path = workspaceTagsPath()
    if (!path) return
    try {
      if (!(await exists(path))) {
        set({ tags: {}, isLoaded: true })
        return
      }
      const data = await readJSON<Record<string, TagEntity>>(path)
      set({ tags: data || {}, isLoaded: true })
    } catch {
      set({ isLoaded: true })
    }
  },

  saveState: async () => {
    const path = workspaceTagsPath()
    if (!path) return
    try {
      const ws = useWorkspaceStore.getState().currentWorkspace
      if (ws?.path && !(await exists(ws.path))) {
        await mkdir(ws.path)
      }
      await writeJSON(path, get().tags)
    } catch {
      /* non-critical */
    }
  },

  ensureTag: (name, opts) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set((state) => {
      const existing = state.tags[trimmed]
      if (existing) {
        if (opts?.flomoSynced && !existing.flomoSynced) {
          return {
            tags: {
              ...state.tags,
              [trimmed]: { ...existing, flomoSynced: true },
            },
          }
        }
        return state
      }
      return {
        tags: {
          ...state.tags,
          [trimmed]: {
            name: trimmed,
            createdAt: Date.now(),
            flomoSynced: opts?.flomoSynced,
          },
        },
      }
    })
    void get().saveState()
  },

  ensureTags: (names, opts) => {
    for (const n of names) get().ensureTag(n, opts)
  },

  getTagCounts: () => {
    const counts: Record<string, number> = {}
    const cards = useCardStore.getState().cards
    for (const card of Object.values(cards)) {
      if (card.deletedAt) continue
      if (card.tags) {
        for (const t of card.tags) {
          if (!t) continue
          counts[t] = (counts[t] || 0) + 1
        }
      }
    }
    return counts
  },

  getTagsSortedByUsage: () => {
    const counts = get().getTagCounts()
    const registered = get().tags
    const allNames = new Set<string>([...Object.keys(counts), ...Object.keys(registered)])
    const result = Array.from(allNames).map((name) => ({
      name,
      count: counts[name] || 0,
      flomoSynced: registered[name]?.flomoSynced,
    }))
    result.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    return result
  },

  renameTag: (oldName, newName) => {
    const oldTrim = oldName.trim()
    const newTrim = newName.trim()
    if (!oldTrim || !newTrim || oldTrim === newTrim) return

    set((state) => {
      const existing = state.tags[oldTrim]
      const tags = { ...state.tags }
      if (existing) {
        const merged: TagEntity = { ...existing, name: newTrim }
        if (tags[newTrim]) {
          merged.flomoSynced = tags[newTrim].flomoSynced || existing.flomoSynced
          merged.createdAt = Math.min(tags[newTrim].createdAt, existing.createdAt)
        }
        tags[newTrim] = merged
        delete tags[oldTrim]
      } else {
        if (!tags[newTrim]) {
          tags[newTrim] = { name: newTrim, createdAt: Date.now() }
        }
      }
      return { tags }
    })

    const cards = useCardStore.getState().cards
    const updates: { id: string; tags?: string[]; content?: string; previewHTML?: string }[] = []
    for (const card of Object.values(cards)) {
      if (card.deletedAt) continue
      let changed = false
      let nextTags = card.tags
      if (card.tags && card.tags.includes(oldTrim)) {
        nextTags = card.tags
          .filter((t) => t !== oldTrim)
          .concat(card.tags.includes(newTrim) ? [] : [newTrim])
        changed = true
      }
      let nextContent = card.content
      let nextPreview = card.previewHTML
      if (card.content) {
        try {
          const blocks = JSON.parse(card.content) as Record<string, unknown>[]
          let touched = false
          walkBlocks(blocks, (node) => {
            const props = node.props as { tagName?: string } | undefined
            if (props?.tagName === oldTrim) {
              touched = true
              return {
                ...node,
                props: { ...props, tagName: newTrim },
                content: [{ type: 'text', text: newTrim, styles: {} }],
              }
            }
            return false
          })
          if (touched) {
            nextContent = JSON.stringify(blocks)
            nextPreview = undefined
            changed = true
          }
        } catch { /* skip */ }
      }
      if (changed) {
        const upd: { id: string; tags?: string[]; content?: string; previewHTML?: string } = {
          id: card.id,
        }
        if (nextTags !== card.tags) upd.tags = nextTags
        if (nextContent !== card.content) upd.content = nextContent
        if (nextPreview !== card.previewHTML) upd.previewHTML = nextPreview
        updates.push(upd)
      }
    }
    for (const u of updates) {
      useCardStore.getState().updateCard(u.id, u)
    }
    void get().saveState()
  },

  deleteTag: (name) => {
    const trim = name.trim()
    if (!trim) return

    set((state) => {
      if (!state.tags[trim]) return state
      const tags = { ...state.tags }
      delete tags[trim]
      return { tags }
    })

    const cards = useCardStore.getState().cards
    const updates: { id: string; tags?: string[]; content?: string; previewHTML?: string }[] = []
    for (const card of Object.values(cards)) {
      if (card.deletedAt) continue
      let changed = false
      let nextTags = card.tags
      if (card.tags && card.tags.includes(trim)) {
        nextTags = card.tags.filter((t) => t !== trim)
        changed = true
      }
      let nextContent = card.content
      let nextPreview = card.previewHTML
      if (card.content) {
        try {
          const blocks = JSON.parse(card.content) as Record<string, unknown>[]
          let touched = false
          walkBlocks(blocks, (node) => {
            const props = node.props as { tagName?: string } | undefined
            if (props?.tagName === trim) {
              touched = true
              return {
                type: 'text',
                text: (node.content as { text?: string }[] | undefined)?.[0]?.text || trim,
                styles: {},
              }
            }
            return false
          })
          if (touched) {
            nextContent = JSON.stringify(blocks)
            nextPreview = undefined
            changed = true
          }
        } catch { /* skip */ }
      }
      if (changed) {
        const upd: { id: string; tags?: string[]; content?: string; previewHTML?: string } = {
          id: card.id,
        }
        if (nextTags !== card.tags) upd.tags = nextTags
        if (nextContent !== card.content) upd.content = nextContent
        if (nextPreview !== card.previewHTML) upd.previewHTML = nextPreview
        updates.push(upd)
      }
    }
    for (const u of updates) {
      useCardStore.getState().updateCard(u.id, u)
    }
    void get().saveState()
  },
}))
