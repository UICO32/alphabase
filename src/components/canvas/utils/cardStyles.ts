import { CARD_COLORS, type CardColor } from '../../../types/card'

export function getCardFill(color: CardColor | undefined, isDarkMode: boolean): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return isDarkMode ? c.fillDark : c.fillLight
}

export function getCardStroke(color: CardColor | undefined): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return c.stroke
}

export function getCardTextColor(color: CardColor | undefined, isDarkMode: boolean): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return isDarkMode ? c.textDark : c.textLight
}

export function getCardMutedTextColor(color: CardColor | undefined, isDarkMode: boolean): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  if (color === 'white' || !color) return isDarkMode ? '#6B7280' : '#9CA3AF'
  return isDarkMode ? c.textDark + '99' : c.textLight + '99'
}