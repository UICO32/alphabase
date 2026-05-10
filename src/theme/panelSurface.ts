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
  return isDarkMode
    ? {
        appBg: '#0a0f1a',
        panelBg: '#0f172a',
        panelAlt: '#111c31',
        surface: '#1e293b',
        card: '#0b1220',
        cardBorder: 'rgba(51,65,85,0.9)',
        text: '#e5e7eb',
        muted: '#94a3b8',
        divider: 'rgba(51,65,85,0.9)',
        shadow: '-12px 0 30px rgba(2,6,23,0.28)',
      }
    : {
        appBg: '#fAfAfA',
        panelBg: '#fAfAfA',
        panelAlt: '#fafaf9',
        surface: '#ffffff',
        card: '#ffffff',
        cardBorder: '#E5E5E5',
        text: '#18181b',
        muted: '#71717a',
        divider: '#EAEAEA',
        shadow: '-12px 0 20px rgba(15,23,42,0.02)',
      }
}