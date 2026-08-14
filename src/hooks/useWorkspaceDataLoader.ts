import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useCardStore } from '../stores/cardStore'
import { useBoardStore } from '../stores/boardStore'
import { useTrashStore } from '../stores/trashStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useTagStore } from '../stores/tagStore'
import { useEvent } from './useEvent'
import { WorkspaceService } from '../services/WorkspaceService'
import { migrateFromLocalStorageIfNeeded } from '../utils/workspace/migrateFromLocalStorage'
import { WorkspaceSyncEngine } from '../sync/syncEngine'
import { initElectronFSAdapter, cardFileToGlobalCard } from '../utils/workspace'
import { exists } from '../utils/workspace/fs'
import { DEFAULT_BOARD_VIEWPORT, getPersistedBoardViewport, type ConflictDiffItem } from '../utils/workspace/types'
import { createFileSystemBackup, startAutoBackup, stopAutoBackup, listFileSystemBackups, restoreFromBackup, getFileSystemBackupSummary } from '../stores/backupStore'
import { setActiveSyncEngine } from '../sync/syncEngineRef'
import { setupSubscriptions } from '../sync/subscriptionManager'
import { embeddingStore } from '../stores/embeddingStore'
import type { CardColor } from '../types/card'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../types/card'
import type { ConflictData } from '../components/ui/WorkspaceConflictDialog'
import { migrateInlineImagesForWorkspace } from '../media/migrateInlineImages'
import { hasInlineMediaNodes, migrateInlineMediaNodes } from '../media/migrateInlineMediaNodes'
import { storeImageDataUrlForWorkspace } from '../media/imagePipeline'
import { preloadCardEditor } from '../components/editor/cardEditorLoader'
import { getStartupCapabilities } from '../platform/electronCapabilities'
import { auditWorkspaceEvent, auditWorkspaceHealth } from '../utils/workspace/audit'

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'

function emitStartupProgress(step: string, progress: number, total: number) {
  console.log(`[renderer] emitStartupProgress: step="${step}" progress=${progress} total=${total}`)
  const capabilities = getStartupCapabilities()
  if (capabilities.ok) capabilities.value.notifyProgress({ step, progress, total })
}

function notifyDataReady() {
  const capabilities = getStartupCapabilities()
  if (capabilities.ok) capabilities.value.notifyDataReady()
}

const __t = { start: 0, steps: [] as { name: string; ms: number }[] }
function stepTime(name: string) {
  const now = performance.now()
  if (__t.start === 0) __t.start = now
  __t.steps.push({ name, ms: Math.round(now - __t.start) })
  console.log(`[startup-renderer] ${name}: ${Math.round(now - __t.start)}ms`)
}

function createDemoCardContent(title: string) {
  return `[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"${title}"}]}]`
}

function scheduleIdleTask(callback: () => void, timeout?: number) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => callback(), timeout ? { timeout } : undefined)
    return
  }
  globalThis.setTimeout(callback, timeout ?? 0)
}

function ensureGlobalDemoCards() {
  const cards = useCardStore.getState().cards
  if (Object.keys(cards).length > 0) return

  const demos = [
    { id: 'card-demo-1', title: '欢迎使用', color: 'blue' as const },
    { id: 'card-demo-2', title: '功能特性', color: 'green' as const },
    { id: 'card-demo-3', title: '快速开始', color: 'yellow' as const },
  ]

  demos.forEach(d => {
    useCardStore.getState().addCard({
      id: d.id,
      content: createDemoCardContent(d.title),
      color: d.color,
      createdAt: Date.now(),
      title: d.title,
    })
  })
}

function ensureDefaultBoard() {
  const boardStore = useBoardStore.getState()
  if (boardStore.boards.length > 0) return

  const id = 'board-default'
  boardStore.addBoard({
    id,
    name: '默认画板',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  boardStore.setActiveBoard(id)

  boardStore.saveBoardData(id, {
    nodes: [
      { id: 'card-demo-1', type: 'card' as const, position: { x: 100, y: 100 }, data: { cardId: 'card-demo-1', color: 'blue', width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT }, width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT },
      { id: 'card-demo-2', type: 'card' as const, position: { x: 500, y: 150 }, data: { cardId: 'card-demo-2', color: 'green', width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT }, width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT },
      { id: 'card-demo-3', type: 'card' as const, position: { x: 300, y: 400 }, data: { cardId: 'card-demo-3', color: 'yellow', width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT }, width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT },
    ],
    edges: [
      { id: `edge-board-default-a`, source: 'card-demo-1', target: 'card-demo-2', type: 'connection' as const },
      { id: `edge-board-default-b`, source: 'card-demo-2', target: 'card-demo-3', type: 'connection' as const },
    ],
  })
  boardStore.setLoaded(true)
}

export function useWorkspaceDataLoader() {
  const [initKey, setInitKey] = useState(0)
  const [dataReady, setDataReady] = useState(false)
  const [conflict, setConflict] = useState<ConflictData | null>(null)
  const [pendingWorkspacePath, setPendingWorkspacePath] = useState<string | null>(null)
  const [hasBackup, setHasBackup] = useState(false)
  const [latestBackupSummary, setLatestBackupSummary] = useState<ConflictData['latestBackup']>(null)

  const loadWorkspaceData = useCallback(async (workspacePath: string, skipValidation: boolean = false) => {
    __t.start = 0; __t.steps = []
    stepTime('loadWorkspaceData-enter')
    const service = new WorkspaceService()
    service.setWorkspacePath(workspacePath)
    await auditWorkspaceHealth(workspacePath, 'loadWorkspaceData-enter')

    emitStartupProgress('加载数据...', 0, 4)

    // Load all data in one pass: manifest + cards + metadata
    // syncEngine.init 负责创建 cards/boards/trash 目录，loadAllCards 依赖目录存在。
    // 并行执行在首次加载（目录不存在）时必然竞态，init 必须先于读完成。
    const syncEngine = new WorkspaceSyncEngine()
    await syncEngine.init(workspacePath)
    await auditWorkspaceHealth(workspacePath, 'loadWorkspaceData-after-sync-init')
    const [manifest, cardFiles, metadata] = await Promise.all([
      service.loadManifest(),
      service.loadAllCards(),
      service.loadMetadata(),
    ])
    await auditWorkspaceHealth(workspacePath, 'loadWorkspaceData-after-read', {
      loadedCards: cardFiles.length,
      manifestBoards: manifest.boards.length,
      metadataCards: metadata?.cardCount ?? null,
      metadataBoards: metadata?.boardCount ?? null,
    })
    setActiveSyncEngine(syncEngine)
    stepTime('data-loaded')

    emitStartupProgress('处理卡片...', 1, 4)

    const globalCards: Record<string, ReturnType<typeof cardFileToGlobalCard>> = {}
    let corruptCardCount = 0
    for (const cf of cardFiles) {
      // cardFileToGlobalCard 对损坏的卡片可能抛异常（例如 content 非法 JSON 被 extractTitleFromContent 间接消费）。
      // 跳过坏卡而非让整个 loadWorkspaceData 走 catch 分支降级为 demo 卡片——否则用户会看到空白工作区。
      try {
        globalCards[cf.id] = cardFileToGlobalCard(cf)
      } catch (err) {
        corruptCardCount++
        console.error('[workspace] 跳过损坏卡片', cf.id, err)
      }
    }
    if (corruptCardCount > 0) {
      toast.error(
        `${corruptCardCount} 张卡片读取失败已跳过，可用「从备份恢复」找回`,
        { duration: 8000 }
      )
    }

    // Load cards into store first (without previewHTML generation — deferred to render)
    useBoardStore.getState().setBoards(manifest.boards)

    // Load cards + board snapshots in parallel — cards go to store, boards to boardData
    const [boardSnapshots] = await Promise.all([
      service.loadAllBoards(),
      useCardStore.getState().reloadFromDB(globalCards),
    ])
    stepTime('cards+boards-loaded')

    // 订阅在 reloadFromDB 之后设置
    setupSubscriptions(syncEngine)
    // 加载标签库（非关键路径，失败不影响主流程）
    useTagStore.getState().loadState().catch(() => {})

    emitStartupProgress('加载画板...', 2, 4)

    // Apply board snapshots
    for (const [boardId, snapshot] of boardSnapshots) {
      const viewport = getPersistedBoardViewport(snapshot.viewport)
      useBoardStore.getState().saveBoardData(boardId, {
        nodes: snapshot.nodes,
        viewport,
        edges: snapshot.edges,
      })
    }

    // Set active board after all board data is loaded
    const lastBoardId = useBoardStore.getState().activeBoardId || manifest.boards[0]?.id
    if (lastBoardId) {
      useBoardStore.getState().setActiveBoard(lastBoardId)
    }

    stepTime('boards-loaded')

    // Validation — skip if requested, or defer if no metadata
    if (!skipValidation && metadata) {
      const cardCountMismatch = metadata.cardCount !== cardFiles.length
      const boardCountMismatch = metadata.boardCount !== manifest.boards.length

      // Check for missing board files in parallel
      const missingBoards: string[] = []
      if (!boardCountMismatch) {
        const existsResults = await Promise.all(
          manifest.boards.map(async (board) => {
            const boardPath = `${workspacePath}/boards/${board.id}.json`
            const fileExists = await exists(boardPath)
            return { id: board.id, exists: fileExists }
          })
        )
        for (const { id, exists: fileExists } of existsResults) {
          if (!fileExists) missingBoards.push(id)
        }
      }

      if (missingBoards.length > 0 || cardCountMismatch || boardCountMismatch) {
        const diffItems: ConflictDiffItem[] = []

        for (const id of missingBoards) {
          const board = manifest.boards.find(b => b.id === id)
          diffItems.push({
            id,
            title: board?.name || id,
            type: 'board',
            diffType: 'missing',
            updatedAt: board?.updatedAt,
          })
        }

        if (cardCountMismatch) {
          if (cardFiles.length > metadata.cardCount) {
            const extraCount = cardFiles.length - metadata.cardCount
            const sortedByTime = [...cardFiles].sort((a, b) =>
              (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)
            )
            for (let i = 0; i < Math.min(extraCount, sortedByTime.length); i++) {
              const c = sortedByTime[i]
              diffItems.push({
                id: c.id,
                title: c.title || c.id,
                type: 'card',
                diffType: 'extra',
                updatedAt: c.updatedAt ?? c.createdAt,
              })
            }
          } else {
            const missingCount = metadata.cardCount - cardFiles.length
            diffItems.push({
              id: '__missing_cards',
              title: `${missingCount} 张卡片`,
              type: 'card',
              diffType: 'missing',
            })
          }
        }

        if (boardCountMismatch && manifest.boards.length < metadata.boardCount) {
          diffItems.push({
            id: '__missing_boards',
            title: `${metadata.boardCount - manifest.boards.length} 个画板`,
            type: 'board',
            diffType: 'missing',
          })
        }

        auditWorkspaceEvent({
          level: 'warn',
          action: 'workspace-conflict-detected',
          workspacePath,
          details: {
            expectedCards: metadata.cardCount,
            actualCards: cardFiles.length,
            expectedBoards: metadata.boardCount,
            actualBoards: manifest.boards.length,
            missingBoards,
            cardCountMismatch,
            boardCountMismatch,
          },
        })
        setConflict({
          expectedCards: metadata.cardCount,
          actualCards: cardFiles.length,
          expectedBoards: metadata.boardCount,
          actualBoards: manifest.boards.length,
          diffItems,
        })
        setPendingWorkspacePath(workspacePath)
        listFileSystemBackups(workspacePath)
          .then(async (backups) => {
            setHasBackup(backups.length > 0)
            const newest = backups[0]
            if (!newest) {
              setLatestBackupSummary(null)
              return
            }
            setLatestBackupSummary(await getFileSystemBackupSummary(newest.timestamp, workspacePath))
          })
          .catch(() => {
            setHasBackup(false)
            setLatestBackupSummary(null)
          })
        setDataReady(true)
        notifyDataReady()
        return
      }
    }

    emitStartupProgress('加载回收站...', 3, 4)

    migrateFromLocalStorageIfNeeded()

    try {
      const trashItems = await service.loadAllTrash()
      const validItems = trashItems.filter(item => item.expiresAt > Date.now()).map(item => ({
        ...item,
        color: (item.color as CardColor) || 'white',
      }))
      useTrashStore.setState({ items: validItems })

      const cardStore = useCardStore.getState()
      for (const item of validItems) {
        const card = cardStore.cards[item.cardId]
        if (card && !card.deletedAt) {
          useCardStore.getState().softDeleteCard(item.cardId)
        }
        if (!card) {
          useCardStore.getState().addCard({
            id: item.cardId,
            content: item.content,
            color: (item.color as CardColor) || 'white',
            createdAt: item.createdAt,
            title: item.title,
            deletedAt: item.deletedAt,
          })
        }
      }

      for (const card of Object.values(cardStore.cards)) {
        if (card.deletedAt && !validItems.some(t => t.cardId === card.id)) {
          useTrashStore.getState().addItem({
            id: `trash-${card.id}`,
            cardId: card.id,
            title: card.title || '无标题',
            content: card.content,
            color: card.color,
            createdAt: card.createdAt,
            enforceInitialHeading: card.enforceInitialHeading,
            fixedHeight: card.fixedHeight,
            collapsed: card.collapsed,
          })
        }
      }
    } catch {
      /* noop */
    }

    stepTime('trash-loaded')

    emitStartupProgress('启动完成', 4, 4)

    // Non-critical: clean expired trash + save metadata — run in parallel, don't block UI
    Promise.all([
      service.cleanExpiredTrash().catch(() => {}),
      service.saveMetadata({
        version: 1,
        cardCount: cardFiles.length,
        boardCount: manifest.boards.length,
        lastModified: Date.now(),
      }).catch(() => {}),
    ])

    // Delay backup + autoBackup 5s to avoid competing with startup
    setTimeout(() => {
      createFileSystemBackup(workspacePath).catch(() => {})
      startAutoBackup(workspacePath)
    }, 5000)

    const name = workspacePath.split(/[\\/]/).filter(Boolean).pop() || '未命名工作区'
    useWorkspaceStore.getState().setCurrentWorkspace({
      path: workspacePath,
      name,
      lastOpened: Date.now(),
    })
    localStorage.setItem(LAST_WORKSPACE_KEY, workspacePath)

    stepTime('dataReady')
    const totalMs = __t.steps[__t.steps.length - 1].ms
    console.log('[startup-renderer] total data load:', totalMs, 'ms')
    console.log('[startup-renderer] breakdown:', __t.steps.map(s => `${s.name}=${s.ms}`).join(', '))
    try {
      sessionStorage.setItem('hepta-startup-log', JSON.stringify({ totalMs, steps: __t.steps }))
    } catch { /* noop */ }
    try {
      const capabilities = getStartupCapabilities()
      if (capabilities.ok) await capabilities.value.log({ totalMs, steps: __t.steps })
    } catch { /* noop */ }
    setDataReady(true)
    notifyDataReady()
    await auditWorkspaceHealth(workspacePath, 'loadWorkspaceData-ready')
    // Preview generation — defer first batch to next frame so React commits
    // canvas mount first, but previews still land before the first paint.
    requestAnimationFrame(() => useCardStore.getState().schedulePreviewHTMLGeneration())
    scheduleIdleTask(async () => {
      const cards = useCardStore.getState().cards
      const boardStore = useBoardStore.getState()
      const hasInlineCards = Object.values(cards).some((card) => card.content?.includes('data:image/'))
      const hasInlineBoards = Object.values(boardStore.boardData).some((data) => hasInlineMediaNodes(data.nodes))
      if (!hasInlineCards && !hasInlineBoards) return

      const safetyBackupPath = await createFileSystemBackup(workspacePath)
      if (!safetyBackupPath) return

      for (const card of Object.values(cards)) {
        if (!card.content) continue
        try {
          const result = await migrateInlineImagesForWorkspace(workspacePath, card.content)
          if (result.changed) useCardStore.getState().updateCard(card.id, { content: result.content })
        } catch { /* preserve the legacy value and continue */ }
      }

      for (const [boardId, data] of Object.entries(boardStore.boardData)) {
        if (!hasInlineMediaNodes(data.nodes)) continue
        try {
          const result = await migrateInlineMediaNodes(
            data.nodes,
            (dataUrl) => storeImageDataUrlForWorkspace(workspacePath, dataUrl),
          )
          if (!result.changed) continue
          boardStore.saveBoardData(boardId, { ...data, nodes: result.nodes })
          syncEngine.scheduleWriteBoard(boardId, {
            version: 2,
            nodes: result.nodes as Parameters<typeof syncEngine.scheduleWriteBoard>[1]['nodes'],
            edges: data.edges as Parameters<typeof syncEngine.scheduleWriteBoard>[1]['edges'],
            viewport: data.viewport ?? DEFAULT_BOARD_VIEWPORT,
          }, 0)
        } catch { /* preserve the legacy value and continue */ }
      }
    }, 10000)

    // Auto-init embedding index — loadStore() inside EmbeddingService will restore vectors.json
    const wsPath = localStorage.getItem(LAST_WORKSPACE_KEY)
    if (wsPath) {
      embeddingStore.getState().initAndEnsureIndexed(wsPath).catch((err: unknown) => {
        console.error('[workspace] embedding init failed:', err)
      })
    }
  }, [])

  const handleConflictChoice = useCallback(async (choice: 'backup' | 'continue' | 'merge' | 'cancel') => {
    setConflict(null)
    if (pendingWorkspacePath) {
      auditWorkspaceEvent({
        action: 'workspace-conflict-choice',
        workspacePath: pendingWorkspacePath,
        details: { choice },
      })
      await auditWorkspaceHealth(pendingWorkspacePath, 'conflict-choice-before', { choice })
    }

    if (choice === 'cancel') {
      setPendingWorkspacePath(null)
      ensureGlobalDemoCards()
      ensureDefaultBoard()
      setDataReady(true)
      notifyDataReady()
      return
    }

    if (choice === 'backup' && pendingWorkspacePath) {
      const backups = await listFileSystemBackups(pendingWorkspacePath)
      if (backups.length > 0) {
        const latestBackup = backups[0] // sorted newest-first by listFileSystemBackups
        const result = await restoreFromBackup(latestBackup.timestamp, pendingWorkspacePath)
        if (result.success) {
          await auditWorkspaceHealth(pendingWorkspacePath, 'conflict-choice-backup-restored', { timestamp: latestBackup.timestamp })
          loadWorkspaceData(pendingWorkspacePath, true).catch((err) => {
            console.error('[workspace] loadWorkspaceData after backup restore failed:', err)
            ensureGlobalDemoCards()
            ensureDefaultBoard()
            setDataReady(true)
            notifyDataReady()
          })
        } else {
          console.error('[workspace] restoreFromBackup failed:', result.error)
          loadWorkspaceData(pendingWorkspacePath, true).catch((err) => {
            console.error('[workspace] loadWorkspaceData after failed restore:', err)
            ensureGlobalDemoCards()
            ensureDefaultBoard()
            setDataReady(true)
            notifyDataReady()
          })
        }
        return
      }
    }

    if (choice === 'merge') {
      console.warn('[workspace] ignored deprecated merge conflict choice')
      setPendingWorkspacePath(null)
      return
    }

    // Continue loading: proceed with the workspace
    if (pendingWorkspacePath) {
      loadWorkspaceData(pendingWorkspacePath, true).catch((err) => {
        console.error('[workspace] loadWorkspaceData after conflict choice failed:', err)
        ensureGlobalDemoCards()
        ensureDefaultBoard()
        setDataReady(true)
        notifyDataReady()
      })
    }
  }, [pendingWorkspacePath, loadWorkspaceData])

  useEvent('reinit-workspace', () => {
    setInitKey(k => k + 1)
    setDataReady(false)
    setConflict(null)
    setPendingWorkspacePath(null)
    setLatestBackupSummary(null)
  })

  useEffect(() => {
    let cancelled = false
    let preloadTimer: ReturnType<typeof setTimeout> | null = null

    ;(async () => {
      try {
        const workspacePath = localStorage.getItem(LAST_WORKSPACE_KEY)

if (!workspacePath) {
	          emitStartupProgress('初始化工作区...', 0, 4)
	          await initElectronFSAdapter()
	          emitStartupProgress('加载卡片数据...', 1, 4)
	          // 不插入 demo 卡片——空工作区显示空画布装饰引导页
	          emitStartupProgress('加载画板...', 2, 4)
	          // 创建默认空画板
	          const boardStore = useBoardStore.getState()
	          boardStore.addBoard({
	            id: 'board-default',
	            name: '默认画板',
	            createdAt: Date.now(),
	            updatedAt: Date.now(),
	          })
	          boardStore.setActiveBoard('board-default')
	          boardStore.setLoaded(true)
	          emitStartupProgress('准备就绪', 4, 4)
	          const ms = Math.round(performance.now())
	          console.log(`[startup-renderer] empty workspace ready: ${ms}ms`)
	          try {
	            const capabilities = getStartupCapabilities()
	            if (capabilities.ok) await capabilities.value.log({ totalMs: ms, steps: [{ name: 'empty-ready', ms }] })
	          } catch { /* noop */ }
	          if (!cancelled) { setDataReady(true); notifyDataReady() }
	          return
	        }

        await initElectronFSAdapter()

        // 预加载编辑器 chunk，不等 dataReady
        preloadTimer = setTimeout(() => {
          preloadCardEditor()
        }, 2000)

        if (!cancelled) {
          await loadWorkspaceData(workspacePath)
        }
      } catch (err) {
        console.error('[workspace] loadWorkspaceData failed:', err)
        ensureGlobalDemoCards()
        ensureDefaultBoard()
        if (!cancelled) { setDataReady(true); notifyDataReady() }
      }
    })()

    return () => {
      cancelled = true
      stopAutoBackup()
      if (preloadTimer) clearTimeout(preloadTimer)
    }
  }, [initKey, loadWorkspaceData])

  return { dataReady, conflict, hasBackup, latestBackupSummary, handleConflictChoice }
}
