import { createElement } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResponsiveSidePanel } from './ResponsiveSidePanel'

describe('ResponsiveSidePanel', () => {
  it('renders a narrow panel as a modal edge drawer', () => {
    render(createElement(ResponsiveSidePanel, {
      side: 'left',
      mode: 'narrow',
      open: true,
      width: 260,
      label: '左侧工作区面板',
      onOpenChange: vi.fn(),
      children: createElement('button', null, '抽屉操作'),
    }))

    const drawer = screen.getByRole('dialog', { name: '左侧工作区面板' })
    expect(drawer.className).toContain('workspace-drawer-left')
    expect(drawer.getAttribute('data-state')).toBe('open')
  })

  it('requests close when Escape is pressed', () => {
    const onOpenChange = vi.fn()
    render(createElement(ResponsiveSidePanel, {
      side: 'right',
      mode: 'narrow',
      open: true,
      width: 320,
      label: '右侧工作区面板',
      onOpenChange,
      children: createElement('button', null, '抽屉操作'),
    }))

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps wide panels in the layout without dialog semantics', () => {
    const { container } = render(createElement(ResponsiveSidePanel, {
      side: 'right',
      mode: 'wide',
      open: false,
      width: 300,
      label: '右侧工作区面板',
      onOpenChange: vi.fn(),
      children: createElement('span', null, '面板内容'),
    }))

    expect(within(container).queryByRole('dialog')).toBeNull()
    expect((container.firstElementChild as HTMLElement).style.transform).toBe('translateX(300px)')
  })
})
