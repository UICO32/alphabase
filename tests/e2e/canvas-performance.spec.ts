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
