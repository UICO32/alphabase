import { useCallback } from 'react'
import { useBoardStore } from '../stores/boardStore'
import { useViewStore } from '../stores/viewStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useProjectStore } from '../stores/projectStore'
import { emit } from '../stores/eventBus'

export function useBoardActions() {
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)
  const viewMode = useViewStore(s => s.viewMode)
  const setViewMode = useViewStore(s => s.setViewMode)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  const createBoard = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const newBoard = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const boardStore = useBoardStore.getState()
    boardStore.addBoard(newBoard)
    boardStore.saveBoardData(newBoard.id, { nodes: [], edges: [] })
    if (viewMode !== 'board') setViewMode('board')
    emit('switch-board', { boardId: newBoard.id })
    return newBoard
  }, [viewMode, setViewMode, emit])

  const renameBoard = useCallback((boardId: string, name: string) => {
    const trimmed = name.trim()
    if (trimmed) {
      useBoardStore.getState().updateBoard(boardId, { name: trimmed })
    }
  }, [])

  const convertBoardToProject = useCallback((boardId: string, questionTitles?: string[]) => {
    // 将现有画布升级为「主题研究」画布（C 端语言为"主题"，内部仍以 project 存储）
    const board = boards.find(b => b.id === boardId)
    if (!board || board.isProject) return null
    useBoardStore.getState().updateBoard(boardId, { isProject: true })
    useProjectStore.getState().createProject(boardId, questionTitles)
    if (viewMode !== 'board') setViewMode('board')
    emit('switch-board', { boardId })
    return board
  }, [boards, viewMode, setViewMode, emit])

  const deleteBoard = useCallback((boardId: string) => {
    if (boards.length <= 1) {
      alert('至少保留一个画板')
      return false
    }
    const board = boards.find(b => b.id === boardId)
    if (window.confirm(`确定删除画板「${board?.name || boardId}」？`)) {
      // 项目画布：联动删除项目元数据（画布快照文件仍由 boardStore/syncEngine 清理）
      if (board?.isProject) {
        useProjectStore.getState().deleteProject(boardId)
      }
      useBoardStore.getState().deleteBoard(boardId)
      if (activeBoardId === boardId) {
        const remaining = boards.filter(b => b.id !== boardId)
        if (remaining.length > 0) {
          emit('switch-board', { boardId: remaining[0].id })
        }
      }
      return true
    }
    return false
  }, [boards, activeBoardId, emit])

  const duplicateBoard = useCallback((boardId: string) => {
    const board = boards.find(b => b.id === boardId)
    if (board) {
      const newBoard = {
        ...board,
        id: crypto.randomUUID(),
        name: `${board.name} (副本)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // 项目副本不传播 isProject：避免两个画布指向同一份 projects/<id>.json
        isProject: false,
      }
      useBoardStore.getState().addBoard(newBoard)
    }
  }, [boards])

  const switchBoard = useCallback((boardId: string) => {
    if (boardId === activeBoardId && viewMode === 'board') return
    if (viewMode !== 'board') setViewMode('board')
    emit('switch-board', { boardId })
  }, [activeBoardId, viewMode, setViewMode, emit])

  const openInExplorer = useCallback(() => {
    if (currentWorkspace?.path) {
      emit('open-in-explorer', { path: currentWorkspace.path })
    }
  }, [currentWorkspace, emit])

  return {
    boards,
    activeBoardId,
    createBoard,
    convertBoardToProject,
    renameBoard,
    deleteBoard,
    duplicateBoard,
    switchBoard,
    openInExplorer,
  }
}