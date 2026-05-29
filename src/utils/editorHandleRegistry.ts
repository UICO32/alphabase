import type { BlockNoteEditorHandle } from '../components/editor/BlockNoteEditor'

const handles = new Map<string, BlockNoteEditorHandle>()

// 标记某卡片的编辑器正在执行 store-level undo/redo
// 在此期间 canUndo/canRedo 应返回 false，防止 ProseMirror 的旧 undo stack 干扰
const suppressProseMirrorFlags = new Set<string>()

export function registerEditorHandle(cardId: string, handle: BlockNoteEditorHandle | null) {
  if (handle) handles.set(cardId, handle)
  else handles.delete(cardId)
}

export function getEditorHandleForCard(cardId: string): BlockNoteEditorHandle | null {
  return handles.get(cardId) ?? null
}

export function suppressProseMirrorUndo(cardId: string) {
  suppressProseMirrorFlags.add(cardId)
}

export function clearProseMirrorSuppression(cardId: string) {
  suppressProseMirrorFlags.delete(cardId)
}

export function isProseMirrorSuppressed(cardId: string): boolean {
  return suppressProseMirrorFlags.has(cardId)
}