export type ThemeMode = 'light' | 'dark' | 'system'

export type ResolvedThemeMode = 'light' | 'dark'

export function getSystemTheme(): ResolvedThemeMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(mode: ThemeMode): ResolvedThemeMode {
  if (mode === 'system') return getSystemTheme()
  return mode
}

export function getTokenValue(name: string, fallback?: string): string {
  if (typeof window === 'undefined') return fallback ?? ''
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || (fallback ?? '')
}

export function getTokens(names: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  names.forEach((name) => {
    result[name] = getTokenValue(name)
  })
  return result
}

let themeTransitionTimer: number | undefined

function withThemeTransition(apply: () => void): void {
  if (typeof document === 'undefined') { apply(); return }
  const root = document.documentElement
  root.classList.add('theme-switching')
  apply()
  if (themeTransitionTimer) window.clearTimeout(themeTransitionTimer)
  themeTransitionTimer = window.setTimeout(() => root.classList.remove('theme-switching'), 320)
}

export function setTheme(mode: ThemeMode): void {
  localStorage.setItem('hepta-theme', mode)
  const resolved = resolveTheme(mode)
  withThemeTransition(() => {
    document.documentElement.setAttribute('data-theme', resolved)
  })
}

export function getTheme(): ThemeMode {
  const stored = localStorage.getItem('hepta-theme')
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'light'
}

export function initTheme(): void {
  const mode = getTheme()
  const resolved = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function toggleTheme(): ThemeMode {
  const current = getTheme()
  const next = current === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}
