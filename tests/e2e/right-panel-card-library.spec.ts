import { expect, test, type Page } from '@playwright/test'

async function enterWorkspaceShell(page: Page) {
  await page.goto('/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })
  await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined)
  const closePicker = page.getByRole('button', { name: '关闭工作区选择' })
  await closePicker.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined)
  if (await closePicker.isVisible().catch(() => false)) await closePicker.click()
}

test('260px card library keeps its controls on one scrollable track and compacts its sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 })
  await enterWorkspaceShell(page)

  const panel = page.locator('.workspace-integrated-panel.absolute.right-0')
  await expect(panel).toBeVisible()
  const libraryTab = panel.getByRole('tab', { name: '卡片库' })
  await libraryTab.click()

  const resizeHandle = panel.locator('.cursor-col-resize')
  const handleBox = await resizeHandle.boundingBox()
  const panelBox = await panel.boundingBox()
  expect(handleBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  const startX = handleBox!.x + handleBox!.width / 2
  await resizeHandle.dispatchEvent('pointerdown', {
    bubbles: true,
    clientX: startX,
    clientY: handleBox!.y + 40,
    pointerId: 1,
    pointerType: 'mouse',
  })
  await page.evaluate(({ clientX }) => {
    document.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX,
      pointerId: 1,
      pointerType: 'mouse',
    }))
    document.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
    }))
  }, { clientX: startX + panelBox!.width - 260 })
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(260)

  const track = panel.getByTestId('card-library-control-track')
  const recent = track.getByRole('button', { name: '最近修改' })
  const tags = track.getByRole('button', { name: '全部标签' })
  const relevance = track.getByRole('button', { name: '相关性' })
  const sync = panel.getByTestId('card-library-flomo-sync')
  await expect(recent).toBeVisible()
  await expect(tags).toBeVisible()
  await expect(relevance).toBeVisible()
  await expect(sync).toBeVisible()

  const trackGeometry = await track.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    syncInsideTrack: element.contains(document.querySelector('[data-testid="card-library-flomo-sync"]')),
  }))
  expect(trackGeometry.scrollWidth).toBeGreaterThan(trackGeometry.clientWidth)
  expect(trackGeometry.syncInsideTrack).toBe(false)
  const syncX = (await sync.boundingBox())!.x
  await track.evaluate(element => { element.scrollLeft = element.scrollWidth })
  expect(Math.abs((await sync.boundingBox())!.x - syncX)).toBeLessThanOrEqual(1)

  const controlY = await Promise.all([recent, tags, relevance].map(async (control) => (await control.boundingBox())!.y))
  expect(Math.max(...controlY) - Math.min(...controlY)).toBeLessThanOrEqual(1)

  const scrollRoot = panel.getByTestId('card-library-scroll-root')
  const header = panel.getByTestId('card-library-header')
  const search = panel.getByTestId('card-library-search')
  await expect(header).toHaveAttribute('data-compact', 'false')
  const defaultLayout = await Promise.all([header.getByRole('heading', { name: '卡片库' }), search]
    .map(async (element) => (await element.boundingBox())!))
  expect(defaultLayout[1].y).toBeGreaterThan(defaultLayout[0].y)

  await scrollRoot.evaluate((element) => {
    const spacer = document.createElement('div')
    spacer.style.height = '2000px'
    element.appendChild(spacer)
    element.scrollTop = 41
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(header).toHaveAttribute('data-compact', 'true')

  // data-compact changes at the start of a 200ms layout transition. Wait for
  // the rendered geometry rather than sampling an arbitrary animation frame.
  await expect.poll(async () => {
    const compactCenters = await Promise.all([header.getByRole('heading', { name: '卡片库' }), search]
      .map(async (element) => {
        const box = (await element.boundingBox())!
        return box.y + box.height / 2
      }))
    return Math.max(...compactCenters) - Math.min(...compactCenters)
  }).toBeLessThanOrEqual(4)

  await scrollRoot.evaluate((element) => {
    element.scrollTop = 20
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(header).toHaveAttribute('data-compact', 'true')

  await scrollRoot.evaluate((element) => {
    element.scrollTop = 8
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(header).toHaveAttribute('data-compact', 'false')
})
