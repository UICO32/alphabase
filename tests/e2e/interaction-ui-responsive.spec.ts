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
