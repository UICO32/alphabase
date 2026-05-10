import { CARD_COLORS, type CardColor, type CardVariant } from '../types/card'

export type CardVariantStyles = {
  cardBg: string
  border: string
  boxShadow: string
  backdropFilter: string
  textColor: string
  mutedTextColor: string
  menuBg: string
  buttonBg: string
}

const darkSurfaceMap: Record<CardColor, { bg: string; border: string; accent: string }> = {
  white:  { bg: '#1e293b', border: '#334155', accent: '#94a3b8' },
  yellow: { bg: '#3b3416', border: '#6b5b16', accent: '#facc15' },
  blue:   { bg: '#172554', border: '#2563eb', accent: '#60a5fa' },
  green:  { bg: '#052e16', border: '#15803d', accent: '#4ade80' },
  pink:   { bg: '#4a044e', border: '#be185d', accent: '#f472b6' },
  purple: { bg: '#2e1065', border: '#7c3aed', accent: '#a78bfa' },
}

function lightGlass(colors: typeof CARD_COLORS[CardColor], isFocused: boolean): CardVariantStyles {
  return {
    cardBg: 'rgba(255,255,255,0.76)',
    border: colors.border,
    boxShadow: isFocused
      ? '0 0 0 2px rgba(59,130,246,0.22), 0 18px 40px rgba(15,23,42,0.12)'
      : '0 8px 24px rgba(15,23,42,0.10)',
    backdropFilter: 'blur(16px)',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    menuBg: 'rgba(255,255,255,0.98)',
    buttonBg: 'rgba(255,255,255,0.95)',
  }
}

function lightOutline(colors: typeof CARD_COLORS[CardColor], isFocused: boolean): CardVariantStyles {
  return {
    cardBg: '#ffffff',
    border: colors.accent,
    boxShadow: isFocused
      ? `0 0 0 2px rgba(59,130,246,0.18), inset 0 0 0 1px ${colors.accent}`
      : `inset 0 0 0 1px ${colors.border}`,
    backdropFilter: 'none',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    menuBg: 'rgba(255,255,255,0.98)',
    buttonBg: 'rgba(255,255,255,0.95)',
  }
}

function lightSolid(colors: typeof CARD_COLORS[CardColor], isFocused: boolean): CardVariantStyles {
  return {
    cardBg: colors.bg,
    border: colors.border,
    boxShadow: isFocused
      ? '0 0 0 2px rgba(59,130,246,0.25), 0 8px 24px rgba(0,0,0,0.12)'
      : '0 2px 8px rgba(0,0,0,0.08)',
    backdropFilter: 'none',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    menuBg: 'rgba(255,255,255,0.98)',
    buttonBg: 'rgba(255,255,255,0.95)',
  }
}

function darkGlass(isFocused: boolean): CardVariantStyles {
  return {
    cardBg: 'linear-gradient(180deg, rgba(30,41,59,0.90), rgba(15,23,42,0.82))',
    border: 'rgba(148,163,184,0.28)',
    boxShadow: isFocused
      ? '0 0 0 2px rgba(96,165,250,0.28), 0 18px 40px rgba(2,6,23,0.45)'
      : '0 10px 30px rgba(2,6,23,0.35)',
    backdropFilter: 'blur(18px)',
    textColor: '#e2e8f0',
    mutedTextColor: '#94a3b8',
    menuBg: 'rgba(15,23,42,0.95)',
    buttonBg: 'rgba(30,41,59,0.92)',
  }
}

function darkOutline(darkSurface: { accent: string; border: string }, isFocused: boolean): CardVariantStyles {
  return {
    cardBg: '#0f172a',
    border: darkSurface.accent,
    boxShadow: isFocused
      ? `0 0 0 2px rgba(96,165,250,0.24), inset 0 0 0 1px ${darkSurface.accent}`
      : `inset 0 0 0 1px ${darkSurface.border}`,
    backdropFilter: 'none',
    textColor: '#e2e8f0',
    mutedTextColor: '#94a3b8',
    menuBg: 'rgba(15,23,42,0.95)',
    buttonBg: 'rgba(30,41,59,0.92)',
  }
}

function darkSolid(darkSurface: { bg: string; border: string }, isFocused: boolean): CardVariantStyles {
  return {
    cardBg: darkSurface.bg,
    border: darkSurface.border,
    boxShadow: isFocused
      ? '0 0 0 2px rgba(96,165,250,0.28), 0 10px 28px rgba(2,6,23,0.38)'
      : '0 4px 14px rgba(2,6,23,0.28)',
    backdropFilter: 'none',
    textColor: '#e2e8f0',
    mutedTextColor: '#94a3b8',
    menuBg: 'rgba(15,23,42,0.95)',
    buttonBg: 'rgba(30,41,59,0.92)',
  }
}

export function getCardVariantStyles(
  color: CardColor | string | undefined,
  variant: CardVariant | string | undefined,
  isDarkMode: boolean,
  isFocused: boolean,
): CardVariantStyles {
  // 确保 color 和 variant 有有效值
  const safeColor = (color && Object.keys(CARD_COLORS).includes(color)) ? color as CardColor : 'white'
  const safeVariant = (variant && ['solid', 'glass', 'outline'].includes(variant)) ? variant as CardVariant : 'solid'

  const colors = CARD_COLORS[safeColor]

  if (isDarkMode) {
    const darkSurface = darkSurfaceMap[safeColor]
    switch (safeVariant) {
      case 'glass':  return darkGlass(isFocused)
      case 'outline': return darkOutline(darkSurface, isFocused)
      case 'solid':
      default:        return darkSolid(darkSurface, isFocused)
    }
  }

  switch (safeVariant) {
    case 'glass':  return lightGlass(colors, isFocused)
    case 'outline': return lightOutline(colors, isFocused)
    case 'solid':
    default:        return lightSolid(colors, isFocused)
  }
}