import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(`${process.cwd()}/src/components/ui/BoardList.tsx`, 'utf8')

describe('BoardList menu definitions', () => {
  it('reuses one menu item instance for context-menu and overflow entry points', () => {
    expect(source).toContain('const menuItems = boardContextMenuItems(board.id)')
    expect(source.match(/<BoardMenuEntries items=\{menuItems\}/g)).toHaveLength(2)
    expect(source).toContain('className={BOARD_MENU_CONTENT_CLASS}')
  })

  it('marks only delete as destructive and normalizes menu icon styling', () => {
    expect(source.match(/danger:\s*true/g)).toHaveLength(1)
    expect(source).toMatch(/Trash[^>]+className="size-4 shrink-0"/)
    expect(source).toMatch(/Pencil[^>]+className="size-4 shrink-0"/)
    expect(source).toMatch(/Copy[^>]+className="size-4 shrink-0"/)
    expect(source).toMatch(/FolderOpen[^>]+className="size-4 shrink-0"/)
  })
})
