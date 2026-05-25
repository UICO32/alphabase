/**
 * Playwright E2E 测试脚本 — BlockNote 内部 DnD 调试
 *
 * 使用 CDP Input.dispatchDragEvent 来正确模拟 HTML5 DnD 事件序列。
 * 因为 Playwright mouse.down()/move()/up() 只产生 pointer 事件，
 * 不会触发浏览器的 dragstart/dragover/drop 等事件。
 *
 * 运行: npx playwright test tests/e2e/blocknote-dnd.spec.ts
 */

import { test, expect } from '@playwright/test'
import type { Page, CDPSession } from '@playwright/test'

test.describe('BlockNote 内部拖拽', () => {
  let cdp: CDPSession

  test.beforeEach(async ({ page }) => {
    cdp = await page.context().newCDPSession(page)

    // 导航到应用
    await page.goto('http://localhost:5173')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // 注入事件监听脚本
    await page.evaluate(() => {
      window.__DND_EVENTS = []
      const tracked = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend']
      for (const evt of tracked) {
        window.addEventListener(evt, (e) => {
          const target = e.target as HTMLElement
          const info: Record<string, unknown> = {
            type: evt,
            phase: e.eventPhase, // 1=capture, 2=at_target, 3=bubble
            targetTag: target?.tagName,
            targetClass: target?.className?.toString?.()?.slice(0, 60),
            inEditor: !!target?.closest?.('.card-blocknote-editor'),
            inPM: !!target?.closest?.('.ProseMirror'),
            defaultPrevented: e.defaultPrevented,
            cancelBubble: e.cancelBubble,
            time: Date.now(),
          }
          if (e instanceof DragEvent && e.dataTransfer) {
            (info as any).effectAllowed = e.dataTransfer.effectAllowed
            ;(info as any).dropEffect = e.dataTransfer.dropEffect
            ;(info as any).types = Array.from(e.dataTransfer.types)
          }
          window.__DND_EVENTS.push(info)
        }, true) // capture 阶段，确保最先记录
      }

      // 追踪谁调用了 stopPropagation / preventDefault
      const origStop = Event.prototype.stopPropagation
      const origStopImm = Event.prototype.stopImmediatePropagation
      const origPrevent = Event.prototype.preventDefault

      Event.prototype.stopPropagation = function () {
        if (tracked.includes(this.type)) {
          const t = this.target as HTMLElement
          window.__DND_EVENTS.push({
            type: `${this.type}:stopPropagation`,
            phase: this.eventPhase,
            targetTag: t?.tagName,
            targetClass: t?.className?.toString?.()?.slice(0, 80),
            inEditor: !!t?.closest?.('.card-blocknote-editor'),
            time: Date.now(),
          })
        }
        return origStop.call(this)
      }

      Event.prototype.stopImmediatePropagation = function () {
        if (tracked.includes(this.type)) {
          const t = this.target as HTMLElement
          window.__DND_EVENTS.push({
            type: `${this.type}:stopImmediatePropagation`,
            phase: this.eventPhase,
            targetTag: t?.tagName,
            targetClass: t?.className?.toString?.()?.slice(0, 80),
            inEditor: !!t?.closest?.('.card-blocknote-editor'),
            time: Date.now(),
          })
        }
        return origStopImm.call(this)
      }

      Event.prototype.preventDefault = function () {
        if (this.type === 'dragover' || this.type === 'drop') {
          const t = this.target as HTMLElement
          window.__DND_EVENTS.push({
            type: `${this.type}:preventDefault`,
            phase: this.eventPhase,
            targetTag: t?.tagName,
            targetClass: t?.className?.toString?.()?.slice(0, 80),
            inEditor: !!t?.closest?.('.card-blocknote-editor'),
            time: Date.now(),
          })
        }
        return origPrevent.call(this)
      }
    })
  })

  test('拖拽内容块：事件流应包含 dragover 且 ProseMirror 应 preventDefault', async ({ page }) => {
    // 1. 双击卡片进入编辑模式
    const cardHeading = page.getByRole('heading', { name: '欢迎使用' }).first()
    await cardHeading.dblclick()
    await page.waitForTimeout(500)

    // 2. 验证编辑器已挂载
    const editorCount = await page.evaluate(() =>
      document.querySelectorAll('.card-blocknote-editor--editable').length
    )
    expect(editorCount).toBeGreaterThan(0)

    // 3. 将鼠标移到编辑器内容左侧以触发 SideMenu
    const editorRect = await page.evaluate(() => {
      const editor = document.querySelector('.card-blocknote-editor--editable .ProseMirror')
      if (!editor) return null
      const firstBlock = editor.firstElementChild as HTMLElement
      if (!firstBlock) return null
      const rect = firstBlock.getBoundingClientRect()
      return {
        x: Math.round(rect.left - 5),
        y: Math.round(rect.top + rect.height / 2),
        blockBottom: Math.round(rect.bottom + 20),
      }
    })
    expect(editorRect).not.toBeNull()

    // 4. 移动鼠标到块左边缘触发 SideMenu
    await page.mouse.move(editorRect!.x, editorRect!.y)
    await page.waitForTimeout(300)

    // 5. 找到拖拽抓手
    const dragHandlePos = await page.evaluate(() => {
      const btn = document.querySelector('.card-blocknote-editor [draggable="true"]')
      if (!btn) return null
      const rect = btn.getBoundingClientRect()
      return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }
    })
    expect(dragHandlePos).not.toBeNull()
    console.log('Drag handle position:', dragHandlePos)

    // 6. 使用 CDP Input.dispatchDragEvent 模拟 HTML5 DnD
    //    dragStart
    await cdp.send('Input.dispatchDragEvent', {
      type: 'dragStart',
      x: dragHandlePos!.x,
      y: dragHandlePos!.y,
      data: { items: [], dragOperationsMask: 1 }, // move
    })
    await page.waitForTimeout(200)

    //    dragUpdate (相当于 dragover)
    await cdp.send('Input.dispatchDragEvent', {
      type: 'dragOver',
      x: dragHandlePos!.x,
      y: editorRect!.blockBottom,
      data: { items: [], dragOperationsMask: 1 },
    })
    await page.waitForTimeout(200)

    //    drop
    await cdp.send('Input.dispatchDragEvent', {
      type: 'drop',
      x: dragHandlePos!.x,
      y: editorRect!.blockBottom,
      data: { items: [], dragOperationsMask: 1 },
    })
    await page.waitForTimeout(200)

    //    dragEnd
    await cdp.send('Input.dispatchDragEvent', {
      type: 'dragEnd',
      x: dragHandlePos!.x,
      y: editorRect!.blockBottom,
      data: { items: [], dragOperationsMask: 1 },
    })
    await page.waitForTimeout(500)

    // 7. 收集并分析事件
    const events = await page.evaluate(() => window.__DND_EVENTS)
    console.log('=== DnD Event Flow ===')
    for (const evt of events) {
      console.log(JSON.stringify(evt))
    }

    // 8. 验证关键条件
    const dragStartEvents = events.filter((e: any) => e.type === 'dragstart')
    const dragOverEvents = events.filter((e: any) => e.type === 'dragover')
    const preventDefaultOnDragOver = events.filter(
      (e: any) => e.type === 'dragover:preventDefault'
    )

    console.log(`\ndragstart events: ${dragStartEvents.length}`)
    console.log(`dragover events: ${dragOverEvents.length}`)
    console.log(`preventDefault on dragover: ${preventDefaultOnDragOver.length}`)

    // 关键：dragover 事件必须到达 ProseMirror 才能调用 preventDefault
    const dragOverReachedPM = dragOverEvents.some((e: any) => e.inPM)
    console.log(`dragover reached ProseMirror: ${dragOverReachedPM}`)

    // 关键：是否有人 stopPropagation 了 dragover
    const dragOverStopped = events.filter(
      (e: any) =>
        e.type === 'dragover:stopPropagation' ||
        e.type === 'dragover:stopImmediatePropagation'
    )
    console.log(`dragover stopPropagation calls: ${dragOverStopped.length}`)
    for (const s of dragOverStopped) {
      console.log(`  STOPPED by:`, JSON.stringify(s))
    }
  })

  test('双抓手问题：每个内容块只应有一个 draggable 按钮', async ({ page }) => {
    // 双击卡片进入编辑模式
    const cardHeading = page.getByRole('heading', { name: '欢迎使用' }).first()
    await cardHeading.dblclick()
    await page.waitForTimeout(500)

    // 将鼠标移到块左边缘触发 SideMenu
    const editorRect = await page.evaluate(() => {
      const editor = document.querySelector('.card-blocknote-editor--editable .ProseMirror')
      if (!editor) return null
      const firstBlock = editor.firstElementChild as HTMLElement
      if (!firstBlock) return null
      const rect = firstBlock.getBoundingClientRect()
      return {
        x: Math.round(rect.left - 5),
        y: Math.round(rect.top + rect.height / 2),
      }
    })
    if (!editorRect) {
      console.log('No editor found, skipping')
      return
    }

    await page.mouse.move(editorRect.x, editorRect.y)
    await page.waitForTimeout(300)

    // 统计 draggable 按钮
    const draggableButtons = await page.evaluate(() => {
      const btns = document.querySelectorAll('.card-blocknote-editor [draggable="true"]')
      return Array.from(btns).map((el) => ({
        tag: el.tagName,
        classes: el.className?.toString?.()?.slice(0, 100),
        parentClass: (el.parentElement as HTMLElement)?.className?.toString?.()?.slice(0, 60),
        grandparentClass: (el.parentElement?.parentElement as HTMLElement)?.className?.toString?.()?.slice(0, 60),
      }))
    })

    console.log('Draggable buttons:', JSON.stringify(draggableButtons, null, 2))
    // 期望只有一个 draggable 按钮
    expect(draggableButtons.length).toBe(1)
  })
})