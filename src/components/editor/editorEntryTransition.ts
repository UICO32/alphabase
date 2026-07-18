export type EditorEntryPhase = 'mounting' | 'ready' | 'interactive'

export interface EditorEntryState {
  entryKey: string
  phase: EditorEntryPhase
}

export type EditorEntryAction =
  | { type: 'reset'; entryKey: string }
  | { type: 'ready'; entryKey: string }
  | { type: 'interactive'; entryKey: string }

export function createEditorEntryState(entryKey: string): EditorEntryState {
  return { entryKey, phase: 'mounting' }
}

export function editorEntryReducer(state: EditorEntryState, action: EditorEntryAction): EditorEntryState {
  if (action.type === 'reset') {
    return action.entryKey === state.entryKey && state.phase === 'mounting'
      ? state
      : createEditorEntryState(action.entryKey)
  }

  if (action.entryKey !== state.entryKey) return state
  if (action.type === 'ready' && state.phase === 'mounting') {
    return { ...state, phase: 'ready' }
  }
  if (action.type === 'interactive' && state.phase !== 'interactive') {
    return { ...state, phase: 'interactive' }
  }
  return state
}

export function shouldRevealEditorImmediately(prefersReducedMotion: boolean) {
  return prefersReducedMotion
}
