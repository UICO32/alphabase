import { useCallback, useRef } from 'react'
import { type Edge, type OnNodeDrag, type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import { getBestHandles } from '../utils/geometry'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, COLLAPSED_CARD_HEIGHT } from '../types/card'
import type { CardNodeData } from '../types/card'
import { globalToLocal, cardOverlapsFrame } from './useFrameSync'
import { computeLayout, updateSingleCardSnapshot, saveFrameSnapshot, type FrameLayout, type KanbanColumn } from '../utils/frameLayouts'
import type { FrameNodeData } from '../components/canvas/FrameNode'
import { kanbanDragPreview } from '../utils/kanbanDragPreview'
import { setDragOverFrameId } from '../utils/frameInteraction'
import { getActiveSyncEngine } from '../sync/syncEngineRef'

interface UseCanvasDragOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void
  setNodes: (updater: Node[] | ((nodes: Node[]) => Node[])) => void
}

export function useCanvasDrag({ reactFlowInstance, setEdges, setNodes }: UseCanvasDragOptions) {
  const dragStartedRef = useRef(false)

  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      const instance = reactFlowInstance.current
      if (!instance) return

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

            // 计算行内位置：找到该列其他卡片，按 y 排序，确定插入行
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

        // 拖入 Frame 高亮反馈：检测卡片是否与某个 Frame 重叠
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
    [reactFlowInstance, setEdges],
  )

  const onNodeDragStop = useCallback((_event: MouseEvent | React.MouseEvent, node: Node) => {
    dragStartedRef.current = false
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

      // 先处理常规的 frame 进入/离开逻辑
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
        // 卡片在同一 frame 内拖动：更新当前 layout 的快照
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

      // 焋板布局重排：如果拖拽的卡片在 kanban frame 内，根据位置重新排列列内卡片
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

        // 找到该 frame 内的子卡片
        const children = next.filter(n => {
          const nd = n.data as Record<string, unknown>
          return nd.frameId === kf.id && n.type === 'card'
        })

        if (children.length === 0) continue

        // 根据卡片位置计算它们属于哪一列
        const frameW = ((kf.data as Record<string, unknown>).width as number) ?? kf.width ?? 600
        const numCols = columns.length
        const colWidth = (frameW - 16 * 2 - (numCols - 1) * 16) / numCols

        // 重新分配 cardIds 到各列
        const newColumns: KanbanColumn[] = columns.map(col => ({
          ...col,
          cardIds: [] as string[],
        }))

        // 按 y 排序卡片（同列内保持纵向顺序）
        const sortedChildren = [...children].sort((a, b) => a.position.y - b.position.y)

        for (const child of sortedChildren) {
          const localX = child.position.x - kf.position.x
          const colIdx = Math.min(
            Math.max(0, Math.floor(localX / (colWidth + 16))),
            numCols - 1,
          )
          newColumns[colIdx].cardIds!.push(child.id)
        }

        // 先更新 frame 的 columns，再基于新 columns 计算布局
        const updatedFrameData = { ...kf.data, columns: newColumns }
        const updatedFrame = { ...kf, data: updatedFrameData }
        const result = computeLayout(updatedFrame, children, 'kanban')

        // 更新 frame 和子卡片位置（含 kanban 快照）
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

      // 增加受影响 Frame 的 snapshotVersion，并重新保存当前 layout 的快照
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

  return { onNodeDrag, onNodeDragStop }
}