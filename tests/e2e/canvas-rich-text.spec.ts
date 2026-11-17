import { test, expect } from '@playwright/test'
import { buildLongTextContent, createTempWorkspace, installTestWorkspaceFs } from './helpers/testWorkspace'

/**
 * 长文本卡片缩放成本回归。
 *
 * 修复前：缩小到缩放预览态时，上百张长文本卡片的正文（上万文本节点）仍然参与
 * 排版与绘制；每次缩放提交还会在画布根节点写 --rf-inv-zoom 等继承变量，迫使浏览器
 * 重算整棵卡片树的样式（120 张长文本卡实测 94ms/次）。这里锚定数据契约：
 * 1) 预览态下正文容器不参与布局；
 * 2) 视口相关的 CSS 变量不再写到画布根上；
 * 3) 预览元素自己带逆向缩放变量；
 * 4) 节点容器的淡出改为直接写 opacity。
 */
test.describe('rich text canvas zoom cost', () => {
  test('zoom preview stops laying out card bodies and viewport vars stay scoped', async ({ page }) => {
    test.slow()
    const tmpDir = createTempWorkspace('hepta-rich-')
    await installTestWorkspaceFs(page, tmpDir)
    await page.goto('/')
    await page.waitForSelector('.react-flow', { timeout: 30000 })

    const templates = Array.from({ length: 6 }, (_, variant) => buildLongTextContent(variant))
    const seed = await page.evaluate(({ templates }) => {
      const api = (window as any).alphabaseAPI
      return api.canvas.seedPerformanceBoard({
        count: 40,
        columns: 8,
        width: 420,
        height: 320,
        spacingX: 170,
        spacingY: 130,
        prefix: 'e2e-rich',
        contentTemplates: templates,
      })
    }, { templates })
    expect(seed.success, seed.error).toBe(true)

    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 40, undefined, { timeout: 30000 })
    await page.waitForTimeout(1200)
    expect(await page.locator('.card-preview-content').count()).toBe(40)

    // 缩小进入缩放预览态（阈值 0.55）：滚轮平滑缩放的第一次事件可能落在画布初始化期间，循环到属性落定。
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const visible = await page.locator('.density-overview-enabled').getAttribute('data-zoom-preview-visible')
      if (visible === 'true') break
      await page.mouse.move(640, 360)
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(500)
    }
    await expect.poll(
      async () => page.locator('.density-overview-enabled').getAttribute('data-zoom-preview-visible'),
      { timeout: 5000 },
    ).toBe('true')
    await page.waitForTimeout(400)

    const previewState = await page.evaluate(() => {
      const canvas = document.querySelector('.density-overview-enabled') as HTMLElement
      const body = document.querySelector('.card-preview-content') as HTMLElement
      const zoomPreview = document.querySelector('.zoom-preview') as HTMLElement
      const nodesLayer = document.querySelector('.react-flow__nodes') as HTMLElement
      const progress = Number(canvas.dataset.densityOverviewProgress ?? 0)
      return {
        bodyDisplay: getComputedStyle(body).display,
        rootVars: ['--rf-inv-zoom', '--rf-zoom', '--density-overview-progress']
          .map(name => canvas.style.getPropertyValue(name)),
        previewInverseZoom: Number(zoomPreview.style.getPropertyValue('--rf-inv-zoom')),
        nodesLayerOpacity: Number(nodesLayer.style.opacity),
        progress,
      }
    })

    // 1) 预览态下正文不参与布局。
    expect(previewState.bodyDisplay).toBe('none')
    // 2) 画布根上不再写继承变量（否则整棵卡片树重算样式）。
    expect(previewState.rootVars).toEqual(['', '', ''])
    // 3) 预览元素自己带逆向缩放变量（缩放 < 1 时大于 1）。
    expect(previewState.previewInverseZoom).toBeGreaterThan(1)
    // 4) 密度总览淡出走容器 opacity，且与进度一致。
    expect(previewState.nodesLayerOpacity).toBeCloseTo(1 - previewState.progress, 2)

    // 放大回阈值以上：正文恢复渲染。
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const visible = await page.locator('.density-overview-enabled').getAttribute('data-zoom-preview-visible')
      if (visible === 'false') break
      await page.mouse.move(640, 360)
      await page.mouse.wheel(0, -400)
      await page.waitForTimeout(500)
    }
    await expect.poll(
      async () => page.locator('.density-overview-enabled').getAttribute('data-zoom-preview-visible'),
      { timeout: 5000 },
    ).toBe('false')
    await page.waitForTimeout(400)
    expect(await page.locator('.card-preview-content').first().evaluate(el => getComputedStyle(el).display)).not.toBe('none')
  })
})
