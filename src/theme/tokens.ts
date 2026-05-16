export type ThemeMode = 'light' | 'dark'

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

export function setTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode)
  localStorage.setItem('hepta-theme', mode)
}

export function getTheme(): ThemeMode {
  const stored = localStorage.getItem('hepta-theme')
  if (stored === 'dark' || stored === 'light') return stored
  return 'light'
}

export function initTheme(): void {
  const mode = getTheme()
  document.documentElement.setAttribute('data-theme', mode)
}

export function toggleTheme(): ThemeMode {
  const current = getTheme()
  const next = current === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

export type PanelSurface = {
  appBg: string
  panelBg: string
  panelAlt: string
  surface: string
  card: string
  cardBorder: string
  text: string
  muted: string
  divider: string
  shadow: string
}

export function getPanelSurface(isDarkMode: boolean): PanelSurface {
  const prevTheme = document.documentElement.getAttribute('data-theme')
  if (isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.setAttribute('data-theme', 'light')
  }

  const surface: PanelSurface = {
    appBg: getTokenValue('--surface-app'),
    panelBg: getTokenValue('--surface-panel'),
    panelAlt: getTokenValue('--surface-panel-alt'),
    surface: getTokenValue('--surface-card'),
    card: getTokenValue('--surface-card'),
    cardBorder: getTokenValue('--border-default'),
    text: getTokenValue('--text-primary'),
    muted: getTokenValue('--text-secondary'),
    divider: getTokenValue('--border-default'),
    shadow: isDarkMode
      ? '-12px 0 30px rgba(2,6,23,0.28)'
      : '-12px 0 20px rgba(15,23,42,0.02)',
  }

  if (prevTheme) {
    document.documentElement.setAttribute('data-theme', prevTheme)
  }

  return surface
}