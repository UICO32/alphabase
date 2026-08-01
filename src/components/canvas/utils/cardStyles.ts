import { CARD_COLORS, type CardColor } from '../../../types/card'

export function getCardFill(color: CardColor | undefined, isDarkMode: boolean): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return isDarkMode ? c.fillDark : c.fillLight
}

export function getCardStroke(color: CardColor | undefined, isDarkMode = false): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return isDarkMode ? (c.strokeDark ?? c.stroke) : c.stroke
}

export function getCardTextColor(color: CardColor | undefined, isDarkMode: boolean): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return isDarkMode ? c.textDark : c.textLight
}

export function getCardMutedTextColor(color: CardColor | undefined, isDarkMode: boolean): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return isDarkMode ? c.mutedDark : c.mutedLight
}