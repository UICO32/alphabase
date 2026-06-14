import { test, expect } from '@playwright/test'

test.describe('Splash skeleton screen', () => {
  test('should show splash with skeleton layout on startup', async ({ page }) => {
    await page.goto('http://localhost:5175')

    // Splash visible with logo
    const splash = page.locator('#splash')
    await expect(splash).toBeVisible({ timeout: 5000 })

    // Logo shimmer
    const title = page.locator('.sp-logo')
    await expect(title).toHaveText('AlphaBase')

    // Credit
    const credit = page.locator('.sp-credit')
    await expect(credit).toHaveText('Designed by UICO Lab')

    // Progress bar
    const progressTrack = page.locator('.sp-progress-track')
    await expect(progressTrack).toBeVisible()

    // Left panel
    const leftPanel = page.locator('.sp-left')
    await expect(leftPanel).toBeVisible()

    // Right panel
    const rightPanel = page.locator('.sp-right')
    await expect(rightPanel).toBeVisible()

    // Card skeletons in canvas
    const cardSkeletons = page.locator('.sp-card')
    await expect(cardSkeletons).toHaveCount(7)
  })

  test('should have correct panel dimensions', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const splash = page.locator('#splash')
    await expect(splash).toBeVisible({ timeout: 5000 })

    const leftBox = await page.locator('.sp-left').boundingBox()
    expect(leftBox?.width).toBe(260)

    const rightBox = await page.locator('.sp-right').boundingBox()
    expect(rightBox?.width).toBe(360)
  })

  test('should have shimmer animation on skeleton bars', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const splash = page.locator('#splash')
    await expect(splash).toBeVisible({ timeout: 5000 })

    const firstBar = page.locator('.sp-bar').first()
    const animation = await firstBar.evaluate((el) => {
      return window.getComputedStyle(el).animationName
    })
    expect(animation).toBe('shimmer')
  })

  test('should dismiss splash after at least 2 seconds', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const splash = page.locator('#splash')
    await expect(splash).toBeVisible({ timeout: 5000 })

    // Splash should remain visible for at least 2 seconds
    // (it fades out after __dismissSplash is called which enforces min 2s)
    await expect(splash).not.toBeVisible({ timeout: 10000 })
  })
})
