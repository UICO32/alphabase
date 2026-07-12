import { lazy } from 'react'

export const LazyCardLibraryView = lazy(() =>
  import('./CardLibraryView').then(m => ({ default: m.CardLibraryView })),
)
