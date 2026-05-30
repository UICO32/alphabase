import { useCallback, useRef, useEffect } from 'react'
import { type Edge, type OnNodeDrag, type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import { getBestHandles } from '../utils/geometry'
import { calcSnapNudge, getNodesBounds, type SnapBounds } from '../utils/alignment'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, COLLAPSED_CARD_HEIGHT } from '../types/card'
import type { CardNodeData } from '../types/card'
import { globalToLocal, cardOverlapsFrame } from './useFrameSync'
import { computeLayout, updateSingleCardSnapshot, saveFrameSnapshot, type FrameLayout, type KanbanColumn } from '../utils/frameLayouts'
import type { FrameNodeData } from '../components/canvas/FrameNode'
import { kanbanDragPreview } from '../utils/kanbanDragPreview'
import { setDragOverFrameId } from '../utils/frameInteraction'
import { getActiveSyncEngine } from '../sync/syncEngineRef'

const SNAP_THRESHOLD_PX = 3

interface SnapLock {
  targetValue: number
}

interface UseCanvasDragOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void
  setNodes: (updater: Node[] | ((nodes: Node[]) => Node[])) => void
}

export function useCanvasDrag({ reactFlowInstance, setEdges, setNodes }: UseCanvasDragOptions) {
  const dragStartedRef = useRef(false)
  const altPressedRef = useRef(false)
  const snapLocksRef = useRef<{ x: SnapLock | null; y: SnapLock | null }>({ x: null, y: null })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) altPressedRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) altPressedRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      const instance = reactFlowInstance.current
      if (!instance) return

      // 隐形边缘吸附：Alt 按下时跳过
      if (!altPressedRef.current && (node.type === 'card' || node.type === 'frame')) {
        const zoom = instance.getViewport().zoom
        const threshold = SNAP_THRESHOLD_PX / zoom

        const allNodes = instance.getNodes()
        const selectedIds = new Set(allNodes.filter(n => n.selected).map(n => n.id))
        const idsToNudge = selectedIds.size > 0 ? selectedIds : new Set([node.id])

        // node.position 是 React Flow 给的未经吸附的"鼠标真实位置"
        const dragData = node.data as CardNodeData
        const dragWidth = dragData.width ?? DEFAULT_CARD_WIDTH
        const dragHeight = dragData.collapsed ? COLLAPSED_CARD_HEIGHT : (dragData.height ?? DEFAULT_CARD_HEIGHT)
        const dragW = node.type === 'frame' ? ((node.data as Record<string, unknown>).width as number) ?? 600 : dragWidth
        const dragH = node.type === 'frame' ? ((node.data as Record<string, unknown>).height as number) ?? 400 : dragHeight

        const dragBounds: SnapBounds = {
          x: node.position.x,
          y: node.position.y,
          width: dragW,
          height: dragH,
        }

        const otherNodes = allNodes.filter(n =>
          !idsToNudge.has(n.id) &&
          (n.type === 'card' || n.type === 'frame' || n.type === 'media')
        )
        const otherBoundsArray = getNodesBounds(otherNodes)

        const locks = snapLocksRef.current
        const freshNudge = calcSnapNudge(dragBounds, otherBoundsArray, threshold)

        // X 轴
        let nudgeX = 0
        if (locks.x) {
          // 已锁定：计算当前鼠标位置到锁定目标的偏移
          nudgeX = locks.x.targetValue - dragBounds.x
          // 判断是否应释放：如果鼠标位置与锁定目标距离超过释放阈值
          if (Math.abs(nudgeX) > threshold * 3) {
            locks.x = null
            nudgeX = 0
          }
        }
        if (!locks.x && freshNudge.x !== 0) {
          const edgeValue = dragBounds.x + freshNudge.x
          locks.x = { targetValue: edgeValue }
          nudgeX = freshNudge.x
        }

        // Y 轴
        let nudgeY = 0
        if (locks.y) {
          nudgeY = locks.y.targetValue - dragBounds.y
          if (Math.abs(nudgeY) > threshold * 3) {
            locks.y = null
            nudgeY = 0
          }
        }
        if (!locks.y && freshNudge.y !== 0) {
          const edgeValue = dragBounds.y + freshNudge.y
          locks.y = { targetValue: edgeValue }
          nudgeY = freshNudge.y
        }

        if (nudgeX !== 0 || nudgeY !== 0) {
          // 直接修改 node.position 引用，React Flow 会在当前帧使用修改后的值
          node.position.x += nudgeX
          node.position.y += nudgeY
          // 同步偏移其他选中节点（直接修改引用，避免 setNodes 与 React Flow 内部状态冲突）
          const allNodes = instance.getNodes()
          for (const n of allNodes) {
            if (n.id !== node.id && idsToNudge.has(n.id)) {
              n.position.x += nudgeX
              n.position.y += nudgeY
            }
          }
        }
      }

      // 看板拖拽预览：计算虚线框位置
      if (node.type === 'card') {
        const nd = node.data as Record<string, unknown>
        const frameId = nd.frameId as string | undefined
        if (frameId) {
          const frameNode = instance.getNode(frameId)
          if (frameNode && (frameNode.data as Record<string, unknown>).layout === 'kanban') {
            const fd = frameNode.data as Record<string, unknown>
            const frameW = (fd.width as number) ?? 600
            const columns = (fd.columns as KanbanColumn[] | undefined) ?? [
              { id: 'col-0', title: 'To Do', color: '#6366f1' },
              { id: 'col-1', title: 'In Progress', color: '#f59e0b' },
              { id: 'col-2', title: 'Done', color: '#10b981' },
            ]
            const numCols = columns.length
            const colWidth = (frameW - 16 * 2 - (numCols - 1) * 16) / numCols
            const localX = node.position.x - frameNode.position.x
            const colIdx = Math.min(Math.max(0, Math.floor(localX / (colWidth + 16))), numCols - 1)
            const colX = 16 + colIdx * (colWidth + 16)
            const HEADER_H = 44
            const COL_HEADER_H = 32
            const CARD_H = 140
            const CARD_GAP = 10
            const startY = HEADER_H + 16 + COL_HEADER_H + 4

            const allNodes = instance.getNodes()
            const siblings = allNodes.filter(n => {
              if (n.id === node.id) return false
              const d = n.data as Record<string, unknown>
              return d.frameId === frameId && n.type === 'card'
            })
            const colCardIds = new Set(columns[colIdx]?.cardIds ?? [])
            const colSiblings = siblings.filter(n => colCardIds.has(n.id))
            const sortedByY = [...colSiblings].sort((a, b) => a.position.y - b.position.y)

            let rowIdx = sortedByY.length
            for (let i = 0; i < sortedByY.length; i++) {
              if (node.position.y < sortedByY[i].position.y + CARD_H / 2) {
                rowIdx = i
                break
              }
            }

            const previewY = startY + rowIdx * (CARD_H + CARD_GAP)
            kanbanDragPreview.set({
              localX: colX,
              localY: previewY,
              width: colWidth,
              height: CARD_H,
              frameId,
            })
          }
        } else {
          kanbanDragPreview.clear()
        }

        const allNodesForHover = instance.getNodes()
        const frameNodesForHover = allNodesForHover.filter(n => n.type === 'frame')
        const hoveredFrame = frameNodesForHover.find(f => cardOverlapsFrame(node, f))
        setDragOverFrameId(hoveredFrame ? hoveredFrame.id : null)
      }

      setEdges((eds) => {
        let changed = false
        const next = eds.map((e) => {
          if (e.source !== node.id && e.target !== node.id) return e
          changed = true
          const sourceNode = instance.getNode(e.source)
          const targetNode = instance.getNode(e.target)
          if (!sourceNode || !targetNode) return e
          const sd = sourceNode.data as CardNodeData
          const sw = sd.width ?? DEFAULT_CARD_WIDTH
          const sh = sd.collapsed ? COLLAPSED_CARD_HEIGHT : (sd.height ?? DEFAULT_CARD_HEIGHT)
          const td = targetNode.data as CardNodeData
          const tw = td.width ?? DEFAULT_CARD_WIDTH
          const th = td.collapsed ? COLLAPSED_CARD_HEIGHT : (td.height ?? DEFAULT_CARD_HEIGHT)
          const handles = getBestHandles(sourceNode.position, { w: sw, h: sh }, targetNode.position, { w: tw, h: th })
          if (e.sourceHandle === handles.sourceHandle && e.targetHandle === handles.targetHandle) return e
          return {
            ...e,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
          }
        })
        return changed ? next : eds
      })
    },
    [reactFlowInstance, setEdges, setNodes],
  )

  const onNodeDragStart = useCallback((_event: MouseEvent | React.MouseEvent, _node: Node) => {
    dragStartedRef.current = true
    snapLocksRef.current = { x: null, y: null }
  }, [])

  const onNodeDragStop = useCallback((_event: MouseEvent | React.MouseEvent, node: Node) => {
    dragStartedRef.current = false
    snapLocksRef.current = { x: null, y: null }
    getActiveSyncEngine()?.setDragging(false)
    kanbanDragPreview.clear()
    setDragOverFrameId(null)
    setEdges((eds) => [...eds])

    if (node.type !== 'card') return

    const instance = reactFlowInstance.current
    if (!instance) return

    const allNodes = instance.getNodes()
    const frameNodes = allNodes.filter(n => n.type === 'frame')

    const selectedCardNodes = allNodes.filter(n => n.selected && n.type === 'card')
    const nodesToUpdate = selectedCardNodes.length > 1 ? selectedCardNodes : [node]

    setNodes(nds => {
      let next = nds

      next = next.map(n => {
        if (!nodesToUpdate.some(u => u.id === n.id)) return n
        const nd = n.data as CardNodeData

        const containingFrame = frameNodes.find(frame => cardOverlapsFrame(n, frame))

        if (containingFrame && containingFrame.id !== nd.frameId) {
          const local = globalToLocal(n.position, containingFrame)
          const frameLayout = ((containingFrame.data as Record<string, unknown>).layout as FrameLayout) ?? 'free'
          return {
            ...n,
            data: {
              ...n.data,
              frameId: containingFrame.id,
              localX: local.x,
              localY: local.y,
              layoutSnapshots: {
                ...nd.layoutSnapshots,
                [frameLayout]: { localX: local.x, localY: local.y, width: nd.width, height: nd.height },
              },
            },
          }
        } else if (!containingFrame && nd.frameId) {
          return {
            ...n,
            data: { ...n.data, frameId: undefined, localX: undefined, localY: undefined },
          }
        }
        if (nd.frameId) {
          const frame = frameNodes.find(f => f.id === nd.frameId)
          if (frame) {
            const frameLayout = ((frame.data as Record<string, unknown>).layout as FrameLayout) ?? 'free'
            const localX = nd.localX ?? (n.position.x - frame.position.x)
            const localY = nd.localY ?? (n.position.y - frame.position.y)
            return {
              ...n,
              data: updateSingleCardSnapshot(nd, frameLayout, localX, localY, nd.width, nd.height),
            }
          }
        }
        return n
      })

      const kanbanFrames = frameNodes.filter(f => {
        const fd = f.data as Record<string, unknown>
        return fd.layout === 'kanban'
      })

      for (const kf of kanbanFrames) {
        const columns = ((kf.data as Record<string, unknown>).columns as KanbanColumn[] | undefined) ?? [
          { id: 'col-0', title: 'To Do', color: '#6366f1' },
          { id: 'col-1', title: 'In Progress', color: '#f59e0b' },
          { id: 'col-2', title: 'Done', color: '#10b981' },
        ]

        const children = next.filter(n => {
          const nd = n.data as Record<string, unknown>
          return nd.frameId === kf.id && n.type === 'card'
        })

        if (children.length === 0) continue

        const frameW = ((kf.data as Record<string, unknown>).width as number) ?? kf.width ?? 600
        const numCols = columns.length
        const colWidth = (frameW - 16 * 2 - (numCols - 1) * 16) / numCols

        const newColumns: KanbanColumn[] = columns.map(col => ({
          ...col,
          cardIds: [] as string[],
        }))

        const sortedChildren = [...children].sort((a, b) => a.position.y - b.position.y)

        for (const child of sortedChildren) {
          const localX = child.position.x - kf.position.x
          const colIdx = Math.min(
            Math.max(0, Math.floor(localX / (colWidth + 16))),
            numCols - 1,
          )
          newColumns[colIdx].cardIds!.push(child.id)
        }

        const updatedFrameData = { ...kf.data, columns: newColumns }
        const updatedFrame = { ...kf, data: updatedFrameData }
        const result = computeLayout(updatedFrame, children, 'kanban')

        const existingFrameSnapshots = ((kf.data as Record<string, unknown>).layoutSnapshots as Record<string, unknown> | undefined) ?? {}
        next = next.map(n => {
          if (n.id === kf.id) {
            return {
              ...n,
              data: {
                ...updatedFrameData,
                layoutSnapshots: {
                  ...existingFrameSnapshots,
                  kanban: {
                    width: ((kf.data as Record<string, unknown>).width as number) ?? 600,
                    height: ((kf.data as Record<string, unknown>).height as number) ?? 400,
                    columns: newColumns,
                  },
                },
              },
            }
          }
          const pos = result.positions[n.id]
          if (pos) {
            const cardData = n.data as CardNodeData
            return {
              ...n,
              position: {
                x: kf.position.x + pos.x,
                y: kf.position.y + pos.y,
              },
              data: {
                ...cardData,
                localX: pos.x,
                localY: pos.y,
                ...(pos.width ? { width: pos.width } : {}),
                ...(pos.height ? { height: pos.height } : {}),
                layoutSnapshots: {
                  ...cardData.layoutSnapshots,
                  kanban: {
                    localX: pos.x,
                    localY: pos.y,
                    width: pos.width,
                    height: pos.height,
                  },
                },
              },
            }
          }
          return n
        })
      }

      const affectedFrameIds = new Set<string>()
      for (const n of next) {
        const nd = n.data as CardNodeData
        if (nd.frameId) affectedFrameIds.add(nd.frameId as string)
      }
      for (const f of frameNodes) {
        affectedFrameIds.add(f.id)
      }
      next = next.map(n => {
        if (affectedFrameIds.has(n.id) && n.type === 'frame') {
          const fd = n.data as Record<string, unknown>
          const newVersion = ((fd.snapshotVersion as number) ?? 0) + 1
          const frameLayout = ((fd.layout as string) ?? 'free') as FrameLayout
          const updatedFrameData = saveFrameSnapshot(
            { ...fd, snapshotVersion: newVersion } as FrameNodeData,
            frameLayout,
          )
          return { ...n, data: { ...updatedFrameData, snapshotVersion: newVersion } }
        }
        return n
      })

      return next
    })
  }, [setEdges, setNodes, reactFlowInstance])

  return { onNodeDrag, onNodeDragStart, onNodeDragStop }
}