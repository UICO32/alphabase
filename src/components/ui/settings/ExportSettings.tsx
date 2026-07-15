import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../shadcn/button'
import { SettingGroup } from './SettingPrimitives'
import { useCardStore, type GlobalCard } from '../../../stores/cardStore'
import { useBoardStore } from '../../../stores/boardStore'
import { useTrashStore, type TrashItem } from '../../../stores/trashStore'
import { getActiveSyncEngine, flushActiveSyncEngine } from '../../../sync/syncEngineRef'
import { deleteFile, exists } from '../../../utils/workspace/fs'
import type { BoardMeta } from '../../../utils/workspace/types'

interface ExportPayload {
  version: 1
  exportedAt: number
  cards: Record<string, GlobalCard>
  boards: BoardMeta[]
  activeBoardId: string | null
  boardData: ReturnType<typeof useBoardStore.getState>['boardData']
  trash: TrashItem[]
}

function isExportPayload(value: unknown): value is ExportPayload {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<ExportPayload>
  return data.version === 1
    && !!data.cards
    && typeof data.cards === 'object'
    && Array.isArray(data.boards)
    && !!data.boardData
    && typeof data.boardData === 'object'
    && Array.isArray(data.trash)
}

function downloadJSON(payload: ExportPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  link.href = url
  link.download = `abase-export-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function ExportSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleExport = () => {
    const boardState = useBoardStore.getState()
    downloadJSON({
      version: 1,
      exportedAt: Date.now(),
      cards: useCardStore.getState().cards,
      boards: boardState.boards,
      activeBoardId: boardState.activeBoardId,
      boardData: boardState.boardData,
      trash: useTrashStore.getState().items,
    })
    toast.success('数据已导出')
  }

  const handleImportFile = async (file: File) => {
    setBusy(true)
    try {
      const payload = JSON.parse(await file.text()) as unknown
      if (!isExportPayload(payload)) {
        toast.error('导入文件格式不正确')
        return
      }

      const previousBoardIds = new Set(useBoardStore.getState().boards.map(board => board.id))
      const nextBoardIds = new Set(payload.boards.map(board => board.id))
      const workspacePath = localStorage.getItem('hepta-last-workspace-path')

      useCardStore.setState({ cards: payload.cards, isLoaded: true })
      useBoardStore.setState({
        boards: payload.boards,
        activeBoardId: payload.activeBoardId ?? payload.boards[0]?.id ?? null,
        boardData: payload.boardData,
        isLoaded: true,
      })
      useTrashStore.setState({ items: payload.trash })

      const syncEngine = getActiveSyncEngine()
      if (syncEngine) {
        for (const board of payload.boards) {
          const data = payload.boardData[board.id] ?? { nodes: [], edges: [] }
          syncEngine.scheduleWriteBoard(board.id, {
            version: 2,
            nodes: data.nodes as never,
            edges: data.edges as never,
            viewport: { x: 0, y: 0, zoom: 1 },
          }, 0)
        }
      }
      if (workspacePath) {
        await Promise.all(
          [...previousBoardIds]
            .filter(boardId => !nextBoardIds.has(boardId))
            .map(async (boardId) => {
              const path = `${workspacePath}/boards/${boardId}.json`
              if (await exists(path)) await deleteFile(path)
            })
        )
      }
      await flushActiveSyncEngine()
      toast.success(`已导入 ${Object.keys(payload.cards).length} 张卡片、${payload.boards.length} 个画板`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <SettingGroup title="导入导出">
      <div className="py-2.5 space-y-2">
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={handleExport} disabled={busy}>
            <Download size={18} /> 导出数据
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <Upload size={18} /> {busy ? '导入中...' : '导入数据'}
          </Button>
        </div>
        <p className="text-xs text-fg-tertiary">
          导出会生成当前工作区快照。导入会用文件内容替换当前工作区，请先导出一份当前数据作为回退。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) void handleImportFile(file)
          }}
        />
      </div>
    </SettingGroup>
  )
}
