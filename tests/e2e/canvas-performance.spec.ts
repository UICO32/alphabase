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
      await page.mouse.wheel(0, -600)
      await page.waitForTimeout(200)

      const visibleNodeCount = await page.locator('.react-flow__node').count()
      console.log(JSON.stringify({
        cardCount,
        seedDurationMs: seed.data.durationMs,
        twoFrameLatencyMs: interaction,
        visibleNodeCount,
      }))

      expect(visibleNodeCount).toBeGreaterThan(0)
      expect(interaction).toBeLessThan(1000)
      expect(errors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
    })
  }
})
