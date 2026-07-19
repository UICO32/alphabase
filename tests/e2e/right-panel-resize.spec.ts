import { test, expect } from '@playwright/test'

test('right panel and canvas aperture stay aligned during resize', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })

  const panel = page.locator('.workspace-integrated-panel.absolute.right-0')
  const aperture = page.locator('.workspace-canvas-aperture')
  const resizeHandle = panel.locator('.cursor-col-resize')

  await expect(panel).toBeVisible()
  await expect(aperture).toBeVisible()

  const handleBox = await resizeHandle.boundingBox()
  expect(handleBox).not.toBeNull()

  const initialGeometry = await page.evaluate(() => {
    const panelElement = document.querySelector<HTMLElement>('.workspace-integrated-panel.absolute.right-0')!
    const apertureElement = document.querySelector<HTMLElement>('.workspace-canvas-aperture')!
    const panelRect = panelElement.getBoundingClientRect()
    const apertureRect = apertureElement.getBoundingClientRect()

    return {
      panelWidth: panelRect.width,
      boundaryGap: panelRect.left - apertureRect.right,
    }
  })

  const startX = handleBox!.x + handleBox!.width / 2
  await resizeHandle.dispatchEvent('pointerdown', {
    bubbles: true,
    clientX: startX,
    clientY: handleBox!.y + 40,
    pointerId: 1,
    pointerType: 'mouse',
  })
  await page.evaluate((clientX) => {
    document.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX,
      pointerId: 1,
      pointerType: 'mouse',
    }))
  }, startX - 96)
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))

  const draggingGeometry = await page.evaluate(() => {
    const panelElement = document.querySelector<HTMLElement>('.workspace-integrated-panel.absolute.right-0')!
    const apertureElement = document.querySelector<HTMLElement>('.workspace-canvas-aperture')!
    const panelRect = panelElement.getBoundingClientRect()
    const apertureRect = apertureElement.getBoundingClientRect()

    return {
      panelWidth: panelRect.width,
      boundaryGap: panelRect.left - apertureRect.right,
      panelTransition: panelElement.style.transition,
      apertureTransition: apertureElement.style.transition,
      resizing: document.documentElement.dataset.rightPanelResizing,
    }
  })

  expect(draggingGeometry.panelWidth).toBeGreaterThan(initialGeometry.panelWidth + 80)
  expect(draggingGeometry.boundaryGap).toBeCloseTo(initialGeometry.boundaryGap, 1)
  expect(draggingGeometry.panelTransition).toBe('none')
  expect(draggingGeometry.apertureTransition).toBe('none')
  expect(draggingGeometry.resizing).toBe('true')

  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
    }))
  })
  await expect.poll(() => page.evaluate(
    () => document.documentElement.dataset.rightPanelResizing ?? null,
  )).toBeNull()
})
