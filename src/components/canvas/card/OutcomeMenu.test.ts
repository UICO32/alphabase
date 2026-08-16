import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/src/components/canvas/card/OutcomeMenu.tsx`, 'utf8')

describe('OutcomeMenu contract', () => {
  it('非主题画布时返回 null（不在普通画布渲染 ★ 按钮）', () => {
    expect(source).toContain('if (!project) return null')
  })

  it('未标记态：菜单列出问题供选择', () => {
    expect(source).toContain('标记为成果 · 选择问题')
    expect(source).toContain('handleSelect = (questionId: string)')
    expect(source).toContain('addOutcome(activeBoardId, cardId, \'card\', questionId)')
  })

  it('已标记态：显示所属问题（可转移）+ 移出成果', () => {
    expect(source).toContain('成果 · 所属问题')
    expect(source).toContain('myOutcome.questionId === q.id')
    expect(source).toContain('移出成果')
    expect(source).toContain('removeOutcome(activeBoardId, myOutcome.id)')
  })

  it('★ 按钮激活态用品牌色，与其他操作按钮并列（24x24 action-icon-btn）', () => {
    expect(source).toContain('data-testid="outcome-menu-trigger"')
    expect(source).toContain('color: isOutcome ? \'var(--brand)\' : undefined')
    expect(source).toContain('width: 24, height: 24')
  })
})
