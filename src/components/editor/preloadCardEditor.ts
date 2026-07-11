let preloaded = false

export function preloadCardEditor() {
  if (preloaded) return
  preloaded = true
  void import('./BlockNoteEditor')
}
