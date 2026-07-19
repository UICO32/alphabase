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

test('shared Tooltip, ContextMenu, and Select use the unified surface', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await enterWorkspaceShell(page)

  const lasso = page.getByRole('button', { name: '框选创建 Frame' })
  await lasso.focus()
  const tooltip = page.locator('.ui-tooltip-content')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('框选创建 Frame')
  await page.keyboard.press('Escape')

  const activeBoard = page.locator('[aria-current="page"]').first()
  await activeBoard.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu).toHaveClass(/ui-floating-content/)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  await page.getByRole('button', { name: '打开设置' }).click()
  await page.getByRole('tab', { name: 'AI 设置' }).click()
  await page.getByRole('combobox').first().click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  await expect(listbox).toHaveClass(/ui-floating-content/)
  await page.keyboard.press('Escape')
})

test('command bar and card editor remain viewport-safe and dismiss with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 })
  await enterWorkspaceShell(page)

  await page.getByRole('button', { name: '剪藏网页' }).click()
  const clipInput = page.getByPlaceholder('粘贴网页链接...')
  await expect(clipInput).toBeFocused()
  const commandBar = page.locator('.ui-command-bar')
  const commandBox = await commandBar.boundingBox()
  expect(commandBox!.x).toBeGreaterThanOrEqual(16)
  expect(commandBox!.x + commandBox!.width).toBeLessThanOrEqual(464)
  await page.keyboard.press('Escape')
  await expect(commandBar).toHaveCount(0)

  await page.getByRole('button', { name: '添加卡片' }).click()
  const openRight = page.getByRole('button', { name: '打开右侧面板' })
  if (await openRight.isVisible().catch(() => false)) await openRight.click()
  await page.getByRole('tab', { name: '卡片库' }).click()
  const card = page.locator('[draggable="true"]').first()
  await expect(card).toBeVisible()
  await card.click()

  const editorDialog = page.locator('.ui-dialog-content').last()
  await expect(editorDialog).toBeVisible()
  await expect.poll(() => editorDialog.evaluate((element) =>
    element.getAnimations().every((animation) => animation.playState === 'finished'),
  )).toBe(true)
  const dialogBox = await editorDialog.boundingBox()
  expect(dialogBox!.x).toBeGreaterThanOrEqual(16)
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(464)
  await page.keyboard.press('Escape')
  await expect(editorDialog).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '右侧工作区面板' })).toBeVisible()
})

test('reduced motion removes spatial movement from shared overlays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await enterWorkspaceShell(page)

  await page.getByRole('button', { name: '框选创建 Frame' }).focus()
  const tooltip = page.locator('.ui-tooltip-content')
  await expect(tooltip).toBeVisible()
  const tooltipMotion = await tooltip.evaluate((element) => {
    const style = getComputedStyle(element)
    return { duration: style.animationDuration, translate: style.translate, transform: style.transform }
  })
  expect(tooltipMotion.duration).toBe('0.001s')
  expect(tooltipMotion.translate).toBe('none')
  expect(tooltipMotion.transform).toBe('none')

  await page.locator('[aria-current="page"]').first().click({ button: 'right' })
  const menu = page.getByRole('menu')
  const menuMotion = await menu.evaluate((element) => {
    const style = getComputedStyle(element)
    return { duration: style.animationDuration, translate: style.translate, transform: style.transform }
  })
  expect(menuMotion.duration).toBe('0.001s')
  expect(menuMotion.translate).toBe('none')
  expect(menuMotion.transform).toBe('none')
})
