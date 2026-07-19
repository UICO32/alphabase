import { test, expect } from '@playwright/test'

test('canvas remains usable after startup', async ({ page }) => {
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })

  const nodeCount = await page.locator('.react-flow__node').count()
  expect(nodeCount).toBeGreaterThanOrEqual(0)

  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.mouse.wheel(0, 400)
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(200)

  expect(errors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

test.describe('canvas large-board baselines', () => {
  for (const cardCount of [1000, 5000]) {
    test(`canvas remains responsive with ${cardCount} cards`, async ({ page }) => {
      test.slow()
      await page.goto('http://localhost:5173/')
      await page.waitForSelector('.react-flow', { timeout: 30000 })

      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })

      const seed = await page.evaluate((count) => {
        const api = (window as any).heptabaseAPI
        return api.canvas.seedPerformanceBoard({
          count,
          columns: Math.ceil(Math.sqrt(count)),
          prefix: `e2e-perf-${count}`,
        })
      }, cardCount)

      expect(seed.success, seed.error).toBe(true)
      expect(seed.data.cardCount).toBe(cardCount)

      await page.waitForFunction(
        () => document.querySelectorAll('.react-flow__node').length > 0,
        undefined,
        { timeout: 30000 },
      )

      const interaction = await page.evaluate(async () => {
        const start = performance.now()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        return Math.round(performance.now() - start)
      })

      await page.mouse.wheel(0, 600)
      await expect.poll(async () => Number(
        await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'),
      )).toBeGreaterThan(0)

      const densityMetrics = await page.locator('.density-overview-layer').evaluate((layer) => ({
        spacing: Number((layer as HTMLElement).dataset.gridSpacing || Number.NaN),
        renderMs: Number((layer as HTMLElement).dataset.renderMs || Number.NaN),
        canvasWidth: (layer.querySelector('canvas') as HTMLCanvasElement | null)?.width ?? 0,
      }))
      expect(densityMetrics.canvasWidth).toBeGreaterThan(0)
      expect(densityMetrics.renderMs).toBeGreaterThanOrEqual(0)
      if (cardCount === 1000) {
        expect(densityMetrics.spacing).toBe(18)
        expect(densityMetrics.renderMs).toBeLessThan(100)
      } else {
        expect(densityMetrics.spacing).toBeGreaterThan(18)
      }

      await page.mouse.wheel(0, -600)
      await page.waitForTimeout(200)

      const visibleNodeCount = await page.locator('.react-flow__node').count()
      console.log(JSON.stringify({
        cardCount,
        seedDurationMs: seed.data.durationMs,
        twoFrameLatencyMs: interaction,
        visibleNodeCount,
        densityRenderMs: densityMetrics.renderMs,
        densityGridSpacing: densityMetrics.spacing,
      }))

      expect(visibleNodeCount).toBeGreaterThan(0)
      expect(interaction).toBeLessThan(1000)
      expect(errors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
    })
  }
})
