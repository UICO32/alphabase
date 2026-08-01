import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const canvasDirectory = dirname(fileURLToPath(import.meta.url))
const canvasSource = readFileSync(resolve(canvasDirectory, 'ReactFlowCanvas.tsx'), 'utf8')
const animationsSource = readFileSync(resolve(canvasDirectory, '../../theme/animations.css'), 'utf8')

describe('canvas empty-state regression contract', () => {
  it('keeps the no-board overlay and its board-creation action', () => {
    expect(canvasSource).toContain('const boards = useBoardStore')
    expect(canvasSource).toMatch(/\{boards\.length === 0 && \(/)
    expect(canvasSource).toContain('boardStore.addBoard(newBoard)')
    expect(canvasSource).toContain("emit('switch-board', { boardId: newBoard.id })")
  })

  it('keeps the empty-board suggested-card fan and landing behavior', () => {
    // isFanView 提取自 boards.length > 0 && nodes.length === 0，
    // fan 视图显示条件等价于原来的单行表达式
    expect(canvasSource).toMatch(/const isFanView = boards\.length > 0 && nodes\.length === 0/)
    expect(canvasSource).toMatch(/isFanView && suggestedCards\.length > 0/)
    expect(canvasSource).toContain('suggestedCards.map((card, index) =>')
    expect(canvasSource).toContain('setFloatingCardId(card.id)')
    expect(canvasSource).toContain("suggested-card-floating")
    expect(canvasSource).toContain('--fan-index')
    expect(canvasSource).toContain("className: 'card-node-landing'")
  })

  it('defines the animation classes consumed by dropped and suggested cards', () => {
    expect(animationsSource).toMatch(/@keyframes\s+card-land/)
    expect(animationsSource).toMatch(/\.card-node-landing(?:\s+\.card-node-default)?\s*\{[^}]*animation:\s*card-land/s)
    expect(animationsSource).toMatch(/@keyframes\s+fan-card-enter/)
    expect(animationsSource).toMatch(/\.suggested-card-floating\s*\{/)
    expect(animationsSource).toMatch(/\.suggested-card::after\s*\{/)
  })
})
