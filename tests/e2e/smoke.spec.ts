import { test, expect } from '@playwright/test'

test('smoke: page loads with React Flow canvas', async ({ page }) => {
  await page.goto('http://localhost:5175/')

  // Wait for React Flow to mount
  await page.waitForSelector('.react-flow', { timeout: 10000 })

  // Verify canvas container exists
  const canvas = page.locator('.react-flow')
  await expect(canvas).toBeVisible()

  // Verify background and controls
  await expect(page.locator('.react-flow__background')).toBeVisible()
  await expect(page.locator('.react-flow__controls')).toBeVisible()
})
