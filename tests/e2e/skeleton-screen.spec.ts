import { test, expect } from '@playwright/test'

test.describe('Splash + SkeletonScreen', () => {
  test('should show splash with shimmer logo', async ({ page }) => {
    await page.goto('http://localhost:5175')

    // Splash should be visible with shimmer logo
    const splash = page.locator('#splash')
    await expect(splash).toBeVisible({ timeout: 5000 })

    // Logo text
    const title = page.locator('#splash-title')
    await expect(title).toHaveText('AlphaBase')

    // Credit
    const credit = page.locator('#splash-credit')
    await expect(credit).toHaveText('Designed by UICO Lab')

    // Progress bar
    const bar = page.locator('#splash-bar')
    await expect(bar).toBeVisible()
  })

  test('should show skeleton screen after splash fades', async ({ page }) => {
    await page.goto('http://localhost:5175')

    // Wait for skeleton to appear (splash fades when React mounts)
    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 8000 })

    // Left panel
    const leftPanel = page.locator('.sk-left-panel')
    await expect(leftPanel).toBeVisible()
    const leftBox = await leftPanel.boundingBox()
    expect(leftBox?.width).toBe(260)

    // Right panel
    const rightPanel = page.locator('.sk-right-panel')
    await expect(rightPanel).toBeVisible()
    const rightBox = await rightPanel.boundingBox()
    expect(rightBox?.width).toBe(360)

    // Card skeletons
    const cardSkeletons = page.locator('.sk-card')
    await expect(cardSkeletons).toHaveCount(7)
  })

  test('should have shimmer animation on skeleton bars', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 8000 })

    const firstBar = page.locator('.sk-bar').first()
    const animation = await firstBar.evaluate((el) => {
      return window.getComputedStyle(el).animationName
    })
    expect(animation).toBe('skeletonPulse')
  })

  test('should transition to real content', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 8000 })

    // Wait for dataReady (2s demo delay + buffer)
    await page.waitForTimeout(4000)

    // Skeleton should be gone
    await expect(skeletonRoot).not.toBeVisible({ timeout: 5000 })
  })
})
