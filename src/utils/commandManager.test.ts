import { describe, it, expect } from 'vitest'
import { CommandManager } from './commandManager'

describe('CommandManager', () => {
  it('execute 应调用 redo 并记录历史', () => {
    const cm = new CommandManager()
    let value = 0
    cm.execute(
      () => { value = 0 },
      () => { value = 1 },
    )
    expect(value).toBe(1)
    expect(cm.canUndo).toBe(true)
    expect(cm.canRedo).toBe(false)
  })

  it('undo 应恢复到之前的状态', () => {
    const cm = new CommandManager()
    let value = 0
    cm.execute(() => { value = 0 }, () => { value = 1 })
    cm.execute(() => { value = 1 }, () => { value = 2 })
    expect(value).toBe(2)

    cm.undo()
    expect(value).toBe(1)
    expect(cm.canRedo).toBe(true)

    cm.undo()
    expect(value).toBe(0)
    expect(cm.canUndo).toBe(false)
  })

  it('redo 应重做已撤销的操作', () => {
    const cm = new CommandManager()
    let value = 0
    cm.execute(() => { value = 0 }, () => { value = 1 })
    cm.execute(() => { value = 1 }, () => { value = 2 })

    cm.undo()
    cm.undo()
    expect(value).toBe(0)

    cm.redo()
    expect(value).toBe(1)

    cm.redo()
    expect(value).toBe(2)
    expect(cm.canRedo).toBe(false)
  })

  it('execute 应截断当前位置之后的历史', () => {
    const cm = new CommandManager()
    let value = 0
    cm.execute(() => { value = 0 }, () => { value = 1 })
    cm.execute(() => { value = 1 }, () => { value = 2 })

    cm.undo()
    expect(value).toBe(1)

    cm.execute(() => { value = 1 }, () => { value = 3 })
    expect(value).toBe(3)
    expect(cm.canRedo).toBe(false)

    cm.undo()
    expect(value).toBe(1)
    expect(cm.canUndo).toBe(true)
  })

  it('clear 应清空历史', () => {
    const cm = new CommandManager()
    let value = 0
    cm.execute(() => { value = 0 }, () => { value = 1 })
    cm.clear()
    expect(cm.canUndo).toBe(false)
    expect(cm.canRedo).toBe(false)
  })

  it('maxSize 应限制历史条数', () => {
    const cm = new CommandManager({ maxSize: 3 })
    let value = 0
    cm.execute(() => { value = 0 }, () => { value = 1 })
    cm.execute(() => { value = 1 }, () => { value = 2 })
    cm.execute(() => { value = 2 }, () => { value = 3 })
    cm.execute(() => { value = 3 }, () => { value = 4 })
    expect(cm.canUndo).toBe(true)

    cm.undo()
    expect(value).toBe(3)
    cm.undo()
    expect(value).toBe(2)
    cm.undo()
    expect(value).toBe(1)
    expect(cm.canUndo).toBe(false)
  })

  it('undo/redo 在边界时应为 no-op', () => {
    const cm = new CommandManager()
    let value = 0
    cm.execute(() => { value = 0 }, () => { value = 1 })

    cm.undo()
    cm.undo()
    expect(value).toBe(0)

    cm.redo()
    expect(value).toBe(1)
    cm.redo()
    expect(value).toBe(1)
  })
})
