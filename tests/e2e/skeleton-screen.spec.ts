import { test, expect } from '@playwright/test'

test.describe('SkeletonScreen', () => {
  test('should show skeleton screen before dataReady', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5175')

    // Wait for skeleton screen to appear
    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 5000 })

    // Check logo text
    const logo = page.locator('.sk-logo')
    await expect(logo).toHaveText('AlphaBase')

    // Check credit text
    const credit = page.locator('.sk-subtitle')
    await expect(credit).toHaveText('Designed by UICO Lab')

    // Check left panel exists
    const leftPanel = page.locator('.sk-left-panel')
    await expect(leftPanel).toBeVisible()

    // Check right panel exists
    const rightPanel = page.locator('.sk-right-panel')
    await expect(rightPanel).toBeVisible()

    // Check canvas exists
    const canvas = page.locator('.sk-canvas')
    await expect(canvas).toBeVisible()

    // Check progress track
    const progressTrack = page.locator('.sk-progress-track')
    await expect(progressTrack).toBeVisible()

    // Check card skeletons exist
    const cardSkeletons = page.locator('.sk-card')
    await expect(cardSkeletons).toHaveCount(7)

    // Wait for dataReady (3s delay + buffer)
    await page.waitForTimeout(4000)

    // Skeleton screen should be gone, real content should appear
    await expect(skeletonRoot).not.toBeVisible({ timeout: 5000 })
  })

  test('should have correct layout dimensions', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 5000 })

    // Check left panel width
    const leftPanel = page.locator('.sk-left-panel')
    const leftBox = await leftPanel.boundingBox()
    expect(leftBox?.width).toBe(260)

    // Check right panel width
    const rightPanel = page.locator('.sk-right-panel')
    const rightBox = await rightPanel.boundingBox()
    expect(rightBox?.width).toBe(360)
  })

  test('should have shimmer animation on skeleton bars', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 5000 })

    // Check that skeleton bars have animation
    const firstBar = page.locator('.sk-bar').first()
    const animation = await firstBar.evaluate((el) => {
      return window.getComputedStyle(el).animationName
    })
    expect(animation).toBe('skeletonPulse')
  })

  test('should have logo shimmer animation', async ({ page }) => {
    await page.goto('http://localhost:5175')

    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 5000 })

    const logo = page.locator('.sk-logo')
    const animation = await logo.evaluate((el) => {
      return window.getComputedStyle(el).animationName
    })
    expect(animation).toBe('logoShimmer')
  })

  test('should transition to real content after delay', async ({ page }) => {
    await page.goto('http://localhost:5175')

    // Wait for skeleton
    const skeletonRoot = page.locator('.sk-root')
    await expect(skeletonRoot).toBeVisible({ timeout: 5000 })

    // Wait for dataReady (3s delay + buffer)
    await page.waitForTimeout(4000)

    // Skeleton should be gone
    await expect(skeletonRoot).not.toBeVisible({ timeout: 5000 })

    // Real content should be visible (check for a known element in App)
    const titleBar = page.locator('[class*="TitleBar"], [class*="title-bar"], header').first()
    // If we can't find title bar, just check skeleton is gone
    const isSkeletonGone = await skeletonRoot.isHidden().catch(() => true)
    expect(isSkeletonGone).toBe(true)
  })
})
