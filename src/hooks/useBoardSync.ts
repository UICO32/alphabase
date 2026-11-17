import { useEffect, useRef, useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'
import { useEvent } from './useEvent'
import { getActiveSyncEngine } from '../sync/syncEngineRef'
import { getBoardHydrationSeq } from '../sync/boardHydration'
import { serializeBoardData } from '../sync/boardSnapshot'
import { DEFAULT_BOARD_VIEWPORT, type BoardViewport } from '../utils/workspace/types'

function hasBoardDataChanged(
  prev: ReturnType<typeof serializeBoardData> | null,
  next: ReturnType<typeof serializeBoardData>,
) {
  if (!prev) return true
  if (prev.nodes.length !== next.nodes.length || prev.edges.length !== next.edges.length) return true
  return JSON.stringify(prev) !== JSON.stringify(next)
}

function sameViewport(a: BoardViewport | null, b: BoardViewport) {
  return a?.x === b.x && a?.y === b.y && a?.zoom === b.zoom
}

export function useBoardSync({
  nodes,
  edges,
  viewportRef,
}: {
  nodes: Node[]
  edges: Edge[]
  viewportRef: React.MutableRefObject<BoardViewport | null>
}) {
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  const isLoaded = useBoardStore((s) => s.isLoaded)
  const saveBoardData = useBoardStore((s) => s.saveBoardData)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadedRef = useRef(isLoaded)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const lastSerializedRef = useRef<ReturnType<typeof serializeBoardData> | null>(null)
  const lastViewportRef = useRef<BoardViewport | null>(null)
  // 初值 -1：挂载后的第一次渲染视为水合结果（画布可能在数据就绪后才挂载），不排盘。
  const lastHydrationSeqRef = useRef(-1)

  isLoadedRef.current = isLoaded
  nodesRef.current = nodes
  edgesRef.current = edges

  const syncToStore = useCallback(() => {
    if (!activeBoardId || !isLoadedRef.current) return

    const data = serializeBoardData(nodesRef.current, edgesRef.current)
    const viewport = viewportRef.current ?? DEFAULT_BOARD_VIEWPORT
    if (!hasBoardDataChanged(lastSerializedRef.current, data) && sameViewport(lastViewportRef.current, viewport)) return
    lastSerializedRef.current = data
    lastViewportRef.current = viewport

    saveBoardData(activeBoardId, { ...data, viewport })

    const syncEngine = getActiveSyncEngine()
    if (syncEngine) {
      syncEngine.scheduleWriteBoard(activeBoardId, {
        version: 2,
        nodes: data.nodes,
        edges: data.edges,
        viewport,
      })
    }
  }, [activeBoardId, saveBoardData, viewportRef])

  const saveViewport = useCallback((viewport: BoardViewport) => {
    if (viewportRef.current?.x === viewport.x && viewportRef.current?.y === viewport.y && viewportRef.current?.zoom === viewport.zoom) return
    viewportRef.current = { x: viewport.x, y: viewport.y, zoom: viewport.zoom }

    if (!useBoardStore.getState().activeBoardId || !isLoadedRef.current) return
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current)
    viewportTimerRef.current = setTimeout(syncToStore, 600)
  }, [syncToStore, viewportRef])

  useEffect(() => {
    lastSerializedRef.current = null
    lastViewportRef.current = null
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current)
      viewportTimerRef.current = null
    }
  }, [activeBoardId])

  // 节点与边本身的改动不排盘（旧实现只由视口变化/切板/卸载触发），这里用同一 600ms
  // 合并防抖补上：拖拽过程中 nodes 每帧变化会不断重置定时器，松手后只写一次最终快照。
  // 水合完成后的第一次变化不是用户改动，跳过；isLoaded 之前同样不排盘。
  useEffect(() => {
    if (!isLoaded || !activeBoardId) return

    const hydrationSeq = getBoardHydrationSeq()
    if (hydrationSeq !== lastHydrationSeqRef.current) {
      lastHydrationSeqRef.current = hydrationSeq
      lastSerializedRef.current = null
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(syncToStore, 600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [nodes, edges, isLoaded, activeBoardId, syncToStore])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current)
        viewportTimerRef.current = null
      }
      if (!isLoadedRef.current) return

      const boardStore = useBoardStore.getState()
      if (boardStore.activeBoardId) {
        const data = serializeBoardData(nodesRef.current, edgesRef.current)
        const viewport = viewportRef.current ?? DEFAULT_BOARD_VIEWPORT
        boardStore.saveBoardData(
          boardStore.activeBoardId,
          {
            ...data,
            viewport,
          },
        )
        getActiveSyncEngine()?.scheduleWriteBoard(boardStore.activeBoardId, {
          version: 2,
          nodes: data.nodes,
          edges: data.edges,
          viewport,
        }, 0)
      }
    }
  }, [])

  useEvent('save-current-board', () => {
    syncToStore()
  }, [syncToStore])

  return saveViewport
}
