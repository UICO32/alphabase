import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './shadcn/dropdown-menu'

afterEach(cleanup)

describe('DropdownMenu foundation', () => {
  it('uses the shared floating surface and focus state without zoom motion', () => {
    render(createElement(DropdownMenu, { defaultOpen: true },
      createElement(DropdownMenuTrigger, null, '打开菜单'),
      createElement(DropdownMenuContent, null,
        createElement(DropdownMenuItem, null, '重命名'),
      ),
    ))

    const menu = screen.getByRole('menu')
    const item = screen.getByRole('menuitem', { name: '重命名' })
    expect(menu.className).toContain('ui-dropdown-content')
    expect(menu.className).toContain('border-line-default')
    expect(menu.className).not.toContain('zoom-in')
    expect(item.className).toContain('focus:bg-surface-card-hover')
  })
})
