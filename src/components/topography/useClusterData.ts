import { useState, useCallback, useEffect, useRef } from 'react'
import { embeddingStore, type ClusterResult } from '../../stores/embeddingStore'
import { useBoardStore } from '../../stores/boardStore'
import { useCardStore } from '../../stores/cardStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { buildTopicPeaks, type TopicPeak } from './types'

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'
const CACHE_DIR = '.topography'
const CACHE_FILE = 'cache.json'

interface CachedTopography {
  version: number
  peaks: TopicPeak[]
  cardCount: number
  cardIdHash: string
  computedAt: number
}

function hashCardIds(cardIds: string[]): string {
  let h = 0
  const sorted = [...cardIds].sort()
  for (const id of sorted) for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return h.toString(36)
}

async function readCache(wsPath: string): Promise<CachedTopography | null> {
  try {
    const sep = wsPath.includes('/') ? '/' : '\\'
    const path = `${wsPath}${sep}${CACHE_DIR}${sep}${CACHE_FILE}`
    const raw = await window.electronAPI.fs.readFile(path)
    if (!raw) return null
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    const data: CachedTopography = JSON.parse(text)
    if (data.version !== 1 || !data.peaks?.length) return null
    return data
  } catch {
    return null
  }
}

async function writeCache(wsPath: string, peaks: TopicPeak[], cardCount: number, cardIdHash: string): Promise<void> {
  try {
    const sep = wsPath.includes('/') ? '/' : '\\'
    const dir = `${wsPath}${sep}${CACHE_DIR}`
    const path = `${dir}${sep}${CACHE_FILE}`
    await window.electronAPI.fs.mkdir(dir)
    const data: CachedTopography = { version: 1, peaks, cardCount, cardIdHash, computedAt: Date.now() }
    await window.electronAPI.fs.writeFile(path, JSON.stringify(data))
  } catch (e) {
    console.warn('[topography] cache write failed:', e)
  }
}

// Build peaks from a cluster result using the current board/card snapshot.
// Kept module-level so both the initial load path and the clusterResult
// subscription rebuild peaks through the same single entry point.
function buildPeaksFromResult(result: ClusterResult): TopicPeak[] {
  const board = useBoardStore.getState()
  const cards = useCardStore.getState()
  const cardPositions: Record<string, { x: number; y: number }> = {}
  const cardLabels: Record<string, string> = {}

  const activeBoardId = board.activeBoardId
  if (activeBoardId) {
    const boardData = board.getBoardData(activeBoardId)
    if (boardData) {
      for (const node of boardData.nodes) {
        if (node.type === 'card' && node.data?.cardId) {
          cardPositions[node.data.cardId as string] = { x: node.position.x, y: node.position.y }
        }
      }
    }
  }
  for (const [id, card] of Object.entries(cards.cards)) {
    cardLabels[id] = card.title || '未命名'
  }
  return buildTopicPeaks(result.clusters, result.orphanCards, cardPositions, cardLabels)
}

export function useClusterData() {
  const [peaks, setPeaks] = useState<TopicPeak[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needModel, setNeedModel] = useState(false)
  const wsPathRef = useRef<string>('')

  const refresh = useCallback(async () => {
    setError(null)
    const wsPath = useWorkspaceStore.getState().currentWorkspace?.path
      || localStorage.getItem(LAST_WORKSPACE_KEY)
    if (!wsPath) {
      setError('No workspace path available')
      setLoading(false)
      return
    }
    wsPathRef.current = wsPath

    // 1. Try cache first — instant display
    const cached = await readCache(wsPath)
    if (cached) {
      console.log('[topography] cache hit:', cached.peaks.length, 'peaks, age:', Math.round((Date.now() - cached.computedAt) / 1000), 's')
      setPeaks(cached.peaks)
      setLoading(false)
    }

    // 2. Ensure embedding store loaded, then trigger clustering. Peaks are
    //    rebuilt by the clusterResult subscription below — refresh() only
    //    kicks off the cluster() call so there's a single peaks entry point.
    try {
      const store = embeddingStore.getState()
      if (!store.storeLoaded) {
        if (!cached) setLoading(true)
        await store.init(wsPath)
      }

      // Check model availability
      const status = await window.electronAPI.embedding.getStatus()
      if (!status.modelAvailable) {
        setNeedModel(true)
        if (!cached) setLoading(false)
        return
      }
      setNeedModel(false)

      const result = await store.cluster(2)
      // result non-empty → clusterResult was set, the subscription rebuilds peaks.
      // Empty/failed result with no cache → show a friendly "indexing" hint.
      if (!result && peaksRef.current.length === 0 && !cached) {
        setError('正在索引卡片…')
        setLoading(false)
      }
    } catch (err: any) {
      console.error('[topography] error:', err)
      if (!cached) {
        setError(err.message)
        setLoading(false)
      }
    }
  }, [])

  async function renameWithLLM() {
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.ai?.generateClusterName) return

    try {
      const config = await electronAPI.ai.getConfig()
      if (!config.configured) return
    } catch {
      return
    }

    // Only rename peaks that still have default labels
    const currentPeaks = peaksRef.current
    for (let i = 0; i < currentPeaks.length; i++) {
      const peak = currentPeaks[i]
      // Skip if already has a good label (not 未命名, not UUID)
      if (peak.label && peak.label !== '未命名' && !isUUID(peak.label)) continue

      const cardLabels: Record<string, string> = {}
      const cards = useCardStore.getState().cards
      for (const id of peak.cardIds) {
        cardLabels[id] = cards[id]?.title || '未命名'
      }

      const titles = peak.cardIds.map(id => cardLabels[id]).filter(t => t && t !== '未命名')
      if (titles.length === 0) continue

      try {
        const resp = await electronAPI.ai.generateClusterName(titles.slice(0, 8))
        if (resp.name) {
          setPeaks(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], label: resp.name }
            return updated
          })
          // Update cache with new label
          const wsPath = wsPathRef.current
          if (wsPath) {
            const latestPeaks = [...currentPeaks]
            latestPeaks[i] = { ...latestPeaks[i], label: resp.name }
            const store = embeddingStore.getState()
            const cards = useCardStore.getState().cards
            writeCache(wsPath, latestPeaks, store.cardCount, hashCardIds(Object.keys(cards)))
          }
        }
      } catch {
        // Keep existing label
      }
    }
  }

  const peaksRef = useRef<TopicPeak[]>([])
  peaksRef.current = peaks

  // Subscribe to clusterResult changes — the SINGLE entry point for rebuilding
  // peaks. Initial load, manual refresh, and incremental re-index all flow
  // through here so peaks stay consistent across paths.
  useEffect(() => {
    const unsub = embeddingStore.subscribe((state, prev) => {
      if (state.clusterResult && state.clusterResult !== prev.clusterResult) {
        const built = buildPeaksFromResult(state.clusterResult)
        setPeaks(built)
        setLoading(false)
        setError(null)

        const wsPath = wsPathRef.current
        if (wsPath) {
          const allCardIds = Object.keys(useCardStore.getState().cards)
          void writeCache(wsPath, built, allCardIds.length, hashCardIds(allCardIds))
        }
        void renameWithLLM()
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { peaks, loading, error, needModel, refresh }
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// Prefetch: called at app startup to warm cache
// If cache is stale or missing, triggers background init + cluster + write
export async function prefetchTopography() {
  const wsPath = useWorkspaceStore.getState().currentWorkspace?.path
    || localStorage.getItem(LAST_WORKSPACE_KEY)
  if (!wsPath) return

  const cached = await readCache(wsPath)
  const allCardIds = Object.keys(useCardStore.getState().cards)
  const currentHash = hashCardIds(allCardIds)

  if (cached && cached.cardIdHash === currentHash) {
    console.log('[topography] prefetch: cache fresh, nothing to do')
    return
  }

  console.log('[topography] prefetch: cache stale or missing, background clustering...')
  const store = embeddingStore.getState()
  if (!store.storeLoaded) {
    try {
      await store.init(wsPath)
    } catch {
      return
    }
  }

  try {
    const result = await store.cluster(2)
    if (!result) return

    const cardPositions: Record<string, { x: number; y: number }> = {}
    const cardLabels: Record<string, string> = {}
    const board = useBoardStore.getState()
    const activeBoardId = board.activeBoardId
    if (activeBoardId) {
      const boardData = board.getBoardData(activeBoardId)
      if (boardData) {
        for (const node of boardData.nodes) {
          if (node.type === 'card' && node.data?.cardId) {
            cardPositions[node.data.cardId as string] = { x: node.position.x, y: node.position.y }
          }
        }
      }
    }
    for (const [id, card] of Object.entries(useCardStore.getState().cards)) {
      cardLabels[id] = card.title || '未命名'
    }

    const built = buildTopicPeaks(result.clusters, result.orphanCards, cardPositions, cardLabels)
    await writeCache(wsPath, built, allCardIds.length, currentHash)
    console.log('[topography] prefetch: cache updated')
  } catch (e) {
    console.warn('[topography] prefetch failed:', e)
  }
}
