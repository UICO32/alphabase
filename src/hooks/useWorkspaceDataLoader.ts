import { useEffect, useState } from 'react'
import { useCardStore } from '../utils/cardStore'
import { useBoardStore } from '../utils/boardStore'
import { useTrashStore } from '../utils/trashStore'
import { WorkspaceService } from '../services/WorkspaceService'
import { migrateFromLocalStorageIfNeeded } from '../utils/migrateFromLocalStorage'
import { WorkspaceSyncEngine, initElectronFSAdapter, cardFileToGlobalCard } from '../utils/workspace'
import { createFileSystemBackup } from '../utils/backupStore'
import { setActiveSyncEngine } from '../utils/syncEngineRef'
import type { CardColor } from '../types/card'

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'

function createDemoCardContent(title: string) {
  return `[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"${title}"}]}]`
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
      { id: 'card-demo-1', type: 'card' as const, position: { x: 100, y: 100 }, data: { cardId: 'card-demo-1', color: 'blue', width: 280, height: 200 }, width: 280, height: 200 },
      { id: 'card-demo-2', type: 'card' as const, position: { x: 500, y: 150 }, data: { cardId: 'card-demo-2', color: 'green', width: 280, height: 200 }, width: 280, height: 200 },
      { id: 'card-demo-3', type: 'card' as const, position: { x: 300, y: 400 }, data: { cardId: 'card-demo-3', color: 'yellow', width: 280, height: 200 }, width: 280, height: 200 },
    ],
    edges: [
      { id: `edge-board-default-a`, source: 'card-demo-1', target: 'card-demo-2', type: 'connection' as const },
      { id: `edge-board-default-b`, source: 'card-demo-2', target: 'card-demo-3', type: 'connection' as const },
    ],
  })
}

export function useWorkspaceDataLoader() {
  const [initKey, setInitKey] = useState(0)
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    const handleReinit = () => {
      setInitKey(k => k + 1)
      setDataReady(false)
    }
    window.addEventListener('hepta-reinit-workspace', handleReinit)
    return () => window.removeEventListener('hepta-reinit-workspace', handleReinit)
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const workspacePath = localStorage.getItem(LAST_WORKSPACE_KEY)

        if (!workspacePath) {
          initElectronFSAdapter()
          ensureGlobalDemoCards()
          ensureDefaultBoard()
          if (!cancelled) setDataReady(true)
          return
        }

        initElectronFSAdapter()

        const service = new WorkspaceService()
        service.setWorkspacePath(workspacePath)

        const syncEngine = new WorkspaceSyncEngine()
        await syncEngine.init(workspacePath)
        setActiveSyncEngine(syncEngine)

        const manifest = await service.loadManifest()
        useBoardStore.getState().setBoards(manifest.boards)

        const cardFiles = await service.loadAllCards()
        const globalCards: Record<string, ReturnType<typeof cardFileToGlobalCard>> = {}
        for (const cf of cardFiles) {
          globalCards[cf.id] = cardFileToGlobalCard(cf)
        }
        await useCardStore.getState().loadCardsFromDB(globalCards)

        migrateFromLocalStorageIfNeeded()

        for (const board of manifest.boards) {
          const snapshot = await service.loadBoard(board.id)
          if (snapshot) {
            useBoardStore.getState().saveBoardData(board.id, {
              nodes: snapshot.nodes,
              edges: snapshot.edges,
            })
          }
        }

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

        try {
          await service.cleanExpiredTrash()
        } catch {
          /* noop */
        }

        createFileSystemBackup(workspacePath).catch(() => {})

        if (!cancelled) setDataReady(true)
      } catch {
        ensureGlobalDemoCards()
        ensureDefaultBoard()
        if (!cancelled) setDataReady(true)
      }
    })()

    return () => { cancelled = true }
  }, [initKey])

  return { dataReady }
}