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

export function setTheme(mode: ThemeMode): void {
  localStorage.setItem('hepta-theme', mode)
  const resolved = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', resolved)
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

export function setPanelHue(hue: number): void {
  document.documentElement.style.setProperty('--panel-hue', String(hue))
  localStorage.setItem('hepta-panel-hue', String(hue))
}

export function getPanelHue(): number {
  const stored = localStorage.getItem('hepta-panel-hue')
  if (stored) {
    const hue = parseInt(stored, 10)
    if (!isNaN(hue)) return hue
  }
  return 220
}

export function initPanelHue(): void {
  const hue = getPanelHue()
  document.documentElement.style.setProperty('--panel-hue', String(hue))
}

export type PanelSurface = {
  appBg: string
  panelBg: string
  panelAlt: string
  panelHover: string
  surface: string
  card: string
  cardHover: string
  cardActive: string
  cardBorder: string
  text: string
  muted: string
  tertiary: string
  disabled: string
  divider: string
  shadow: string
  accentBg?: string
  accentText?: string
}

export function getPanelSurface(isDarkMode: boolean): PanelSurface {
  const prevTheme = document.documentElement.getAttribute('data-theme')
  const targetTheme = isDarkMode ? 'dark' : 'light'

  if (prevTheme !== targetTheme) {
    document.documentElement.setAttribute('data-theme', targetTheme)
  }

  const surface: PanelSurface = {
    appBg: getTokenValue('--surface-app'),
    panelBg: getTokenValue('--surface-panel'),
    panelAlt: getTokenValue('--surface-panel-alt'),
    panelHover: getTokenValue('--surface-panel-hover'),
    surface: getTokenValue('--surface-card'),
    card: getTokenValue('--surface-card'),
    cardHover: getTokenValue('--surface-card-hover'),
    cardActive: getTokenValue('--surface-card-active'),
    cardBorder: getTokenValue('--border-default'),
    text: getTokenValue('--text-primary'),
    muted: getTokenValue('--text-secondary'),
    tertiary: getTokenValue('--text-tertiary'),
    disabled: getTokenValue('--text-disabled'),
    divider: getTokenValue('--border-default'),
    shadow: getTokenValue('--shadow-lg'),
  }

  if (prevTheme && prevTheme !== targetTheme) {
    document.documentElement.setAttribute('data-theme', prevTheme)
  }

  return surface
}
