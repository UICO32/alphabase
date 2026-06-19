import { describe, it, expect } from 'vitest'
import { getCardFill, getCardStroke, getCardTextColor, getCardMutedTextColor } from './cardStyles'
import { CARD_COLORS, type CardColor } from '../../../types/card'

describe('getCardFill', () => {
  const colors: CardColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'gray']

  it('每种颜色亮模式应返回 fillLight', () => {
    for (const color of colors) {
      expect(getCardFill(color, false)).toBe(CARD_COLORS[color].fillLight)
    }
  })

  it('每种颜色暗模式应返回 fillDark', () => {
    for (const color of colors) {
      expect(getCardFill(color, true)).toBe(CARD_COLORS[color].fillDark)
    }
  })

  it('undefined 应默认白色', () => {
    expect(getCardFill(undefined, false)).toBe(CARD_COLORS.white.fillLight)
    expect(getCardFill(undefined, true)).toBe(CARD_COLORS.white.fillDark)
  })
})

describe('getCardStroke', () => {
  it('每种颜色应返回对应 stroke', () => {
    const colors: CardColor[] = ['white', 'red', 'blue', 'gray']
    for (const color of colors) {
      expect(getCardStroke(color)).toBe(CARD_COLORS[color].stroke)
    }
  })

  it('undefined 应默认白色 stroke', () => {
    expect(getCardStroke(undefined)).toBe(CARD_COLORS.white.stroke)
  })
})

describe('getCardTextColor', () => {
  it('亮模式应返回 textLight', () => {
    expect(getCardTextColor('red', false)).toBe(CARD_COLORS.red.textLight)
  })

  it('暗模式应返回 textDark', () => {
    expect(getCardTextColor('red', true)).toBe(CARD_COLORS.red.textDark)
  })

  it('undefined 应默认白色', () => {
    expect(getCardTextColor(undefined, false)).toBe(CARD_COLORS.white.textLight)
  })
})

describe('getCardMutedTextColor', () => {
  it('white/undefined 亮模式应返回 mutedLight', () => {
    expect(getCardMutedTextColor('white', false)).toBe(CARD_COLORS.white.mutedLight)
    expect(getCardMutedTextColor(undefined, false)).toBe(CARD_COLORS.white.mutedLight)
  })

  it('white/undefined 暗模式应返回 mutedDark', () => {
    expect(getCardMutedTextColor('white', true)).toBe(CARD_COLORS.white.mutedDark)
    expect(getCardMutedTextColor(undefined, true)).toBe(CARD_COLORS.white.mutedDark)
  })

  it('非白色应返回对应 muted 字段', () => {
    expect(getCardMutedTextColor('red', false)).toBe(CARD_COLORS.red.mutedLight)
    expect(getCardMutedTextColor('red', true)).toBe(CARD_COLORS.red.mutedDark)
  })
})
