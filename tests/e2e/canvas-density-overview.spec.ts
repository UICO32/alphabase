import { test, expect, type Page } from '@playwright/test'

async function enterDensityOverview(page: Page) {
  const flow = page.locator('.react-flow')
  const box = await flow.boundingBox()
  if (!box) throw new Error('React Flow canvas has no bounding box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.mouse.wheel(0, 900)
    const progress = Number(await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'))
    if (progress >= 0.99) break
  }
  await expect.poll(async () => Number(
    await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'),
  )).toBeGreaterThanOrEqual(0.99)
  await expect(page.getByTestId('density-overview-layer')).toHaveAttribute('data-progress', '1.000')
}

test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })
  const workspacePicker = page.locator('.fixed.inset-0.z-50')
  if (await workspacePicker.isVisible()) {
    await workspacePicker.locator('button').first().click()
  }
})

test('zoom reveals a board-local density field and pinned cluster drawer', async ({ page }) => {
  const errors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })

  const seeded = await page.evaluate(() => {
    const api = (window as any).heptabaseAPI
    const result = api.canvas.seedPerformanceBoard({ count: 5, columns: 3, prefix: 'density-e2e' })
    api.cards.update('density-e2e-card-0', { tags: ['alpha'] })
    api.cards.update('density-e2e-card-1', { tags: ['alpha'] })
    api.cards.update('density-e2e-card-2', { tags: ['beta'] })
    api.cards.update('density-e2e-card-3', { tags: ['beta'] })
    return result
  })
  expect(seeded.success, seeded.error).toBe(true)
  await page.waitForSelector('[data-id="density-e2e-card-0"]')

  await enterDensityOverview(page)
  await expect(page.getByTestId('density-overview-layer')).toHaveAttribute('data-group-count', '2')

  const canvasMetrics = await page.locator('.density-overview-canvas').evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height,
    renderMs: Number(canvas.parentElement?.dataset.renderMs || Number.NaN),
  }))
  expect(canvasMetrics.width).toBeGreaterThan(0)
  expect(canvasMetrics.height).toBeGreaterThan(0)
  expect(canvasMetrics.renderMs).toBeGreaterThanOrEqual(0)

  const source = await page.locator('[data-id="density-e2e-card-0"]').boundingBox()
  if (!source) throw new Error('Source card is not rendered')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await expect(page.getByRole('complementary', { name: /semantic cluster/i })).toBeVisible()
  await page.mouse.click(source.x + source.width / 2, source.y + source.height / 2)

  const drawer = page.getByRole('complementary', { name: /semantic cluster/i })
  await expect(drawer).toHaveClass(/is-pinned/)
  await expect(drawer.getByRole('button')).toHaveCount(2)
  await expect(page.locator('.density-overview-connectors path')).toHaveCount(2)

  await drawer.getByRole('button').first().click()
  await expect.poll(async () => Number(
    await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'),
  )).toBeLessThan(0.72)
  await expect(drawer).toHaveCount(0)
  expect(errors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

test('orphan fields stay visible without opening a semantic drawer', async ({ page }) => {
  const seeded = await page.evaluate(() => {
    const api = (window as any).heptabaseAPI
    const result = api.canvas.seedPerformanceBoard({ count: 3, columns: 3, prefix: 'density-orphan' })
    api.cards.update('density-orphan-card-0', { tags: ['paired'] })
    api.cards.update('density-orphan-card-1', { tags: ['paired'] })
    return result
  })
  expect(seeded.success, seeded.error).toBe(true)
  await page.waitForSelector('[data-id="density-orphan-card-2"]')
  await enterDensityOverview(page)

  const orphan = await page.locator('[data-id="density-orphan-card-2"]').boundingBox()
  if (!orphan) throw new Error('Orphan card is not rendered')
  await page.mouse.move(orphan.x + orphan.width / 2, orphan.y + orphan.height / 2)
  await page.waitForTimeout(180)
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.locator('.density-overview-canvas')).toBeVisible()
})
