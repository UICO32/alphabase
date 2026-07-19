import { expect, test, type Page } from '@playwright/test'

async function enterWorkspaceShell(page: Page) {
  await page.goto('/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })
  await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined)

  const closePicker = page.getByRole('button', { name: '关闭工作区选择' })
  await closePicker.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined)
  if (await closePicker.isVisible().catch(() => false)) {
    await closePicker.click()
    await expect(page.locator('.ui-dialog-overlay')).toHaveCount(0)
  }
}

test('narrow drawer traps Tab focus and returns focus after Escape', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 })
  await enterWorkspaceShell(page)

  const trigger = page.getByRole('button', { name: '打开右侧面板' })
  await trigger.click()

  const drawer = page.getByRole('dialog', { name: '右侧工作区面板' })
  await expect(drawer).toBeVisible()

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab')
    await expect(drawer).toBeVisible()
    await expect.poll(() => drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('persistent toolbar tools expose their selected state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await enterWorkspaceShell(page)

  const lasso = page.getByRole('button', { name: '框选创建 Frame' })
  await expect(lasso).toHaveAttribute('aria-pressed', 'false')
  await lasso.click()
  await expect(lasso).toHaveAttribute('aria-pressed', 'true')

  const topography = page.getByRole('button', { name: '打开 3D 地形视图' })
  await expect(topography).toHaveAttribute('aria-pressed', 'false')
})

test('reduced motion removes drawer and segmented-control movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 480, height: 800 })
  await enterWorkspaceShell(page)
  await page.getByRole('button', { name: '打开右侧面板' }).click()

  const drawer = page.getByRole('dialog', { name: '右侧工作区面板' })
  await expect(drawer).toBeVisible()
  const drawerMotion = await drawer.evaluate((element) => {
    const style = getComputedStyle(element)
    return { animationDuration: style.animationDuration, transform: style.transform }
  })
  expect(drawerMotion.animationDuration).toBe('0.001s')
  expect(drawerMotion.transform).toBe('none')

  const segmented = page.locator('.segmented').first()
  await expect(segmented).toBeVisible()
  const indicatorTransition = await segmented.evaluate((element) =>
    getComputedStyle(element, '::after').transitionDuration,
  )
  expect(indicatorTransition.split(',').every((duration) => duration.trim() === '0.001s')).toBe(true)
})
