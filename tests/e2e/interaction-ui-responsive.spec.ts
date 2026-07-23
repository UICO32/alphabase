import { expect, test, type Page } from '@playwright/test'

async function enterWorkspaceShell(page: Page) {
  await page.goto('/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })
  await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined)
  const closePicker = page.getByRole('button', { name: '关闭工作区选择' })
  await closePicker.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined)
  if (await closePicker.isVisible().catch(() => false)) {
    await closePicker.click()
    await expect(closePicker).toHaveCount(0)
    await expect(page.locator('.ui-dialog-overlay')).toHaveCount(0)
  }
}

test('medium width keeps only one side panel open', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await enterWorkspaceShell(page)

  const openRight = page.getByRole('button', { name: '打开右侧面板' })
  if (await openRight.isVisible()) await openRight.click()

  await expect(page.getByRole('button', { name: '打开左侧面板' })).toBeVisible()
  await expect(page.getByRole('button', { name: '打开右侧面板' })).toHaveCount(0)
  await expect(page.locator('.workspace-drawer-overlay')).toHaveCount(0)
})

test('narrow width uses a flush edge drawer and restores trigger focus', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 })
  await enterWorkspaceShell(page)

  const openRight = page.getByRole('button', { name: '打开右侧面板' })
  await openRight.click()

  const drawer = page.getByRole('dialog', { name: '右侧工作区面板' })
  await expect(drawer).toBeVisible()
  await expect.poll(async () => {
    const rect = await drawer.evaluate((element) => element.getBoundingClientRect())
    return Math.round(rect.right)
  }).toBe(480)
  const box = await drawer.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeCloseTo(480, 0)
  expect(box!.width).toBeLessThanOrEqual(480 * 0.88 + 1)
  await expect(page.locator('.workspace-drawer-overlay')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(page.getByRole('button', { name: '打开右侧面板' })).toBeFocused()
})

test('card library controls wrap without collapsing labels vertically', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await enterWorkspaceShell(page)
  await page.getByRole('button', { name: '打开右侧面板' }).click()

  const recent = page.getByRole('button', { name: '最近修改' })
  const relevance = page.getByRole('button', { name: '相关性' })
  const sync = page.getByRole('button', { name: '同步 Flomo' })
  await expect(recent).toBeVisible()
  await expect(relevance).toBeVisible()
  await expect(sync).toBeVisible()

  const geometry = await Promise.all([recent, relevance, sync].map(async (locator) => {
    const box = await locator.boundingBox()
    return {
      box,
      whiteSpace: await locator.evaluate((element) => getComputedStyle(element).whiteSpace),
    }
  }))

  for (const control of geometry) {
    expect(control.whiteSpace).toBe('nowrap')
    expect(control.box!.width).toBeGreaterThan(control.box!.height)
  }
  expect(geometry[2].box!.y).toBeGreaterThanOrEqual(geometry[0].box!.y)
})

test('narrow card library drag reaches the canvas through the drawer overlay', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 })
  await enterWorkspaceShell(page)

  const canvasNodes = page.locator('.react-flow__node')
  const initialNodeCount = await canvasNodes.count()
  await page.locator('button[aria-label="添加卡片"]').click()
  await expect(canvasNodes).toHaveCount(initialNodeCount + 1)

  const openRightPanel = page.locator('button[aria-label="打开右侧面板"]')
  if (await openRightPanel.isVisible().catch(() => false)) await openRightPanel.click()
  const drawer = page.locator('.workspace-drawer-right')
  await expect(drawer).toBeVisible()
  await drawer.locator('[role="tab"]').first().click()
  const source = drawer.locator('[draggable="true"]').first()
  await expect(source).toBeVisible()

  const dragResult = await source.evaluate((element) => {
    const sourceElement = element as HTMLElement
    const sourceRect = sourceElement.getBoundingClientRect()
    const dataTransfer = new DataTransfer()
    sourceElement.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      clientX: sourceRect.left + 20,
      clientY: sourceRect.top + 20,
      dataTransfer,
      altKey: true,
    }))

    const target = document.elementFromPoint(40, 300) as HTMLElement | null
    target?.dispatchEvent(new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 300,
      dataTransfer,
    }))
    target?.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 300,
      dataTransfer,
    }))

    const result = {
      bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
      overlayPointerEvents: getComputedStyle(document.querySelector('.workspace-drawer-overlay') as HTMLElement).pointerEvents,
      targetInsideCanvas: !!target?.closest('.react-flow'),
    }
    sourceElement.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }))
    return result
  })

  expect(dragResult).toEqual({
    bodyPointerEvents: 'auto',
    overlayPointerEvents: 'none',
    targetInsideCanvas: true,
  })
  await expect(canvasNodes).toHaveCount(initialNodeCount + 2)
})
