import { lazy } from 'react'

export const LazyCardBlockNoteEditor = lazy(() =>
  import('./BlockNoteEditor').then(m => ({ default: m.CardBlockNoteEditor })),
)

let preloaded = false

export function preloadCardEditor() {
  if (preloaded) return
  preloaded = true
  void import('./BlockNoteEditor')
}
