import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog, DialogContent, DialogTitle } from './shadcn/dialog'
import { WorkspaceConflictDialog } from './WorkspaceConflictDialog'

afterEach(cleanup)

describe('Dialog foundation', () => {
  it('uses viewport-safe sizing and can omit the default close control', () => {
    render(createElement(Dialog, { open: true },
      createElement(DialogContent, { size: 'lg', showCloseButton: false },
        createElement(DialogTitle, null, '测试弹窗'),
      ),
    ))

    const dialog = screen.getByRole('dialog', { name: '测试弹窗' })
    expect(dialog.className).toContain('w-[calc(100vw-2rem)]')
    expect(dialog.className).toContain('max-w-[600px]')
    expect(screen.queryByRole('button', { name: '关闭' })).toBeNull()
  })

  it('keeps the workspace conflict decision open on Escape', () => {
    const onChoice = vi.fn()
    render(createElement(WorkspaceConflictDialog, {
      conflict: {
        expectedCards: 2,
        actualCards: 1,
        expectedBoards: 1,
        actualBoards: 1,
        diffItems: [],
      },
      hasBackup: false,
      latestBackup: null,
      onChoice,
    }))

    const dialog = screen.getByRole('dialog', { name: '检测到工作区数据不完整' })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.getByRole('dialog', { name: '检测到工作区数据不完整' })).toBe(dialog)
    expect(onChoice).not.toHaveBeenCalled()
  })
})
