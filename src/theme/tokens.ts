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
  // Prefer view-transition API (Chromium 111+) — zero per-element transition overhead
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }
  if (doc.startViewTransition) {
    const t = doc.startViewTransition(() => apply())
    t.finished.catch(() => {})
    return
  }
  // Fallback: scoped transition on root only (not * selector)
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
    applyAccentColor(getAccentColor())
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
  applyAccentColor(getAccentColor())
}

export function toggleTheme(): ThemeMode {
  const current = getTheme()
  const next = current === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

// ── Accent color (brand color customization) ──

const ACCENT_STORAGE_KEY = 'hepta-accent-color'

export function getAccentColor(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCENT_STORAGE_KEY)
}

export function applyAccentColor(color: string | null): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const derived = [
    '--brand', '--brand-hover', '--brand-soft', '--brand-ring',
    '--tag-color', '--tag-bg', '--tag-bg-hover',
    '--card-ref-color', '--card-ref-bg', '--card-ref-bg-hover',
    '--fg-link', '--fg-link-hover', '--line-focus',
  ]
  if (!color) {
    for (const p of derived) root.style.removeProperty(p)
    return
  }
  const isDark = root.getAttribute('data-theme') === 'dark'
  const base = isDark ? `color-mix(in srgb, ${color} 72%, #ffffff)` : color
  const hover = isDark
    ? `color-mix(in srgb, ${color} 58%, #ffffff)`
    : `color-mix(in srgb, ${color} 86%, #000000)`
  const soft = `color-mix(in srgb, ${base} 12%, transparent)`
  const softHover = isDark
    ? `color-mix(in srgb, ${base} 28%, transparent)`
    : `color-mix(in srgb, ${base} 22%, transparent)`
  const ring = `color-mix(in srgb, ${base} 35%, transparent)`
  const s = root.style
  s.setProperty('--brand', base)
  s.setProperty('--brand-hover', hover)
  s.setProperty('--brand-soft', soft)
  s.setProperty('--brand-ring', ring)
  s.setProperty('--tag-color', base)
  s.setProperty('--tag-bg', soft)
  s.setProperty('--tag-bg-hover', softHover)
  s.setProperty('--card-ref-color', base)
  s.setProperty('--card-ref-bg', soft)
  s.setProperty('--card-ref-bg-hover', softHover)
  s.setProperty('--fg-link', base)
  s.setProperty('--fg-link-hover', hover)
  s.setProperty('--line-focus', ring)
}

export function setAccentColor(color: string | null): void {
  if (typeof window === 'undefined') return
  if (color) localStorage.setItem(ACCENT_STORAGE_KEY, color)
  else localStorage.removeItem(ACCENT_STORAGE_KEY)
  applyAccentColor(color)
}
