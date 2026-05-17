import { create } from 'zustand'
import { convertFlomoMemo, type FlomoMemo } from './flomoConverter'
import { useCardStore, type GlobalCard } from './cardStore'
import { useWorkspaceStore } from './workspace/workspaceStore'

export interface FlomoSyncState {
  syncing: boolean
  lastSyncTime: string | null
  importedCount: number
  error: string | null
  accessToken: string | null
  email: string | null
  importedSlugs: string[]
}

interface FlomoSyncActions {
  login: (email: string, password: string) => Promise<void>
  sync: () => Promise<number>
  logout: () => void
  loadState: () => Promise<void>
  _saveState: () => Promise<void>
}

export const useFlomoSyncStore = create<FlomoSyncState & FlomoSyncActions>((set, get) => ({
  syncing: false,
  lastSyncTime: null,
  importedCount: 0,
  error: null,
  accessToken: null,
  email: null,
  importedSlugs: [],

  login: async (email: string, password: string) => {
    set({ error: null })
    try {
      const result = await window.electronAPI.flomo.login(email, password)
      set({ accessToken: result.accessToken, email })
      await get()._saveState()
    } catch (e: any) {
      set({ error: e.message || '登录失败' })
      throw e
    }
  },

  sync: async () => {
    const { syncing, accessToken, importedSlugs } = get()
    if (syncing || !accessToken) return 0

    set({ syncing: true, error: null })
    try {
      const { memos } = await window.electronAPI.flomo.fetchMemos(
        accessToken,
        get().lastSyncTime || undefined
      )

      const slugSet = new Set(importedSlugs)
      const newMemos = (memos as FlomoMemo[]).filter(m => !slugSet.has(m.slug))

      if (newMemos.length === 0) {
        set({ syncing: false, lastSyncTime: new Date().toISOString() })
        await get()._saveState()
        return 0
      }

      const workspaceDir = useWorkspaceStore.getState().currentWorkspace?.path
      const cards: GlobalCard[] = []

      for (const memo of newMemos) {
        const converted = convertFlomoMemo(memo)

        if (converted.imageUrls.length > 0 && workspaceDir) {
          for (let i = 0; i < converted.imageUrls.length; i++) {
            const imgUrl = converted.imageUrls[i]
            const ext = imgUrl.match(/\.(png|jpg|jpeg|gif|webp)/i)?.[1] || 'png'
            const fileName = `flomo_${memo.slug}_${i}.${ext}`
            const destPath = `${workspaceDir}/assets/flomo/${fileName}`
            const result = await window.electronAPI.flomo.downloadImg(imgUrl, destPath)
            if (result.success) {
              converted.blocks = converted.blocks.map((b: any) => {
                if (b.type === 'image' && b.props?.url === imgUrl) {
                  return { ...b, props: { ...b.props, url: `assets/flomo/${fileName}` } }
                }
                return b
              })
            }
          }
        }

        const card: GlobalCard = {
          id: crypto.randomUUID(),
          title: converted.title,
          content: JSON.stringify(converted.blocks),
          previewHTML: '',
          tags: converted.tags,
          color: 'white',
          createdAt: new Date(memo.created_at).getTime(),
          updatedAt: new Date(memo.updated_at).getTime(),
          flomoSlug: memo.slug,
        }
        cards.push(card)
      }

      useCardStore.getState().importCards(
        Object.fromEntries(cards.map(c => [c.id, c]))
      )

      const newSlugs = [...importedSlugs, ...newMemos.map(m => m.slug)]

      set({
        syncing: false,
        lastSyncTime: new Date().toISOString(),
        importedCount: get().importedCount + newMemos.length,
        importedSlugs: newSlugs,
      })
      await get()._saveState()
      return newMemos.length
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') {
        set({ syncing: false, error: '登录已过期，请重新登录', accessToken: null })
      } else {
        set({ syncing: false, error: e.message || '同步失败' })
      }
      return 0
    }
  },

  logout: () => {
    set({ accessToken: null, email: null })
    get()._saveState()
  },

  loadState: async () => {
    try {
      const workspaceDir = useWorkspaceStore.getState().currentWorkspace?.path
      if (!workspaceDir) return
      const content = await window.electronAPI.fs.readFile(`${workspaceDir}/flomo-sync.json`)
      const text = new TextDecoder().decode(content)
      const data = JSON.parse(text)
      set({
        lastSyncTime: data.lastSyncTime || null,
        importedCount: data.importedCount || 0,
        accessToken: data.accessToken || null,
        email: data.email || null,
        importedSlugs: data.importedSlugs || [],
      })
    } catch {
      // 文件不存在，使用默认值
    }
  },

  _saveState: async () => {
    const { lastSyncTime, importedCount, accessToken, email, importedSlugs } = get()
    const workspaceDir = useWorkspaceStore.getState().currentWorkspace?.path
    if (!workspaceDir) return
    const data = { lastSyncTime, importedCount, accessToken, email, importedSlugs }
    await window.electronAPI.fs.writeFile(
      `${workspaceDir}/flomo-sync.json`,
      JSON.stringify(data, null, 2)
    )
  },
}))