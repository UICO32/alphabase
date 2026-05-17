import { useCallback } from 'react'
import { useBoardStore } from '../utils/boardStore'
import { useLibraryStore } from '../utils/libraryStore'
import { useWorkspaceStore } from '../utils/workspace/workspaceStore'

export function useBoardActions() {
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)
  const viewMode = useLibraryStore(s => s.viewMode)
  const setViewMode = useLibraryStore(s => s.setViewMode)
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
    window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId: newBoard.id } }))
    return newBoard
  }, [viewMode, setViewMode])

  const renameBoard = useCallback((boardId: string, name: string) => {
    const trimmed = name.trim()
    if (trimmed) {
      useBoardStore.getState().updateBoard(boardId, { name: trimmed })
    }
  }, [])

  const deleteBoard = useCallback((boardId: string) => {
    if (boards.length <= 1) {
      alert('至少保留一个画板')
      return false
    }
    const board = boards.find(b => b.id === boardId)
    if (window.confirm(`确定删除画板「${board?.name || boardId}」？`)) {
      useBoardStore.getState().deleteBoard(boardId)
      if (activeBoardId === boardId) {
        const remaining = boards.filter(b => b.id !== boardId)
        if (remaining.length > 0) {
          window.dispatchEvent(new CustomEvent('hepta-switch-board', {
            detail: { boardId: remaining[0].id }
          }))
        }
      }
      return true
    }
    return false
  }, [boards, activeBoardId])

  const duplicateBoard = useCallback((boardId: string) => {
    const board = boards.find(b => b.id === boardId)
    if (board) {
      const newBoard = {
        ...board,
        id: crypto.randomUUID(),
        name: `${board.name} (副本)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      useBoardStore.getState().addBoard(newBoard)
    }
  }, [boards])

  const switchBoard = useCallback((boardId: string) => {
    if (boardId === activeBoardId && viewMode === 'board') return
    if (viewMode !== 'board') setViewMode('board')
    window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId } }))
  }, [activeBoardId, viewMode, setViewMode])

  const openInExplorer = useCallback(() => {
    if (currentWorkspace?.path) {
      window.dispatchEvent(new CustomEvent('hepta-open-in-explorer', {
        detail: { path: currentWorkspace.path }
      }))
    }
  }, [currentWorkspace])

  return {
    boards,
    activeBoardId,
    createBoard,
    renameBoard,
    deleteBoard,
    duplicateBoard,
    switchBoard,
    openInExplorer,
  }
}