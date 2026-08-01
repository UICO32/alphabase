import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MultiSelectionScaler } from './MultiSelectionScaler'
import type { Node } from '@xyflow/react'

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: vi.fn(),
    screenToFlowPosition: (p: { x: number; y: number }) => p,
    flowToScreenPosition: (p: { x: number; y: number }) => p,
  }),
  // transform = [0, 0, 1]（zoom=1）
  useStore: () => [0, 0, 1],
}))

const makeNode = (id: string, x: number, y: number, w: number, h: number): Node => ({
  id,
  type: 'card',
  position: { x, y },
  width: w,
  height: h,
  data: { cardId: id, color: 'white', width: w, height: h },
})

describe('MultiSelectionScaler 渲染', () => {
  it('选中 2 个节点时渲染包围盒虚线框与 4 个角手柄', () => {
    const { container } = render(
      <MultiSelectionScaler
        nodes={[makeNode('a', 0, 0, 200, 150), makeNode('b', 300, 200, 100, 100)]}
        onScaleStart={vi.fn()}
        onScaleEnd={vi.fn()}
      />,
    )
    const dashes = container.querySelectorAll('[style*="dashed"]')
    const handles = container.querySelectorAll('[style*="resize"]')
    expect(dashes).toHaveLength(1)
    expect(handles).toHaveLength(4)
  })

  it('选中 1 个节点时不渲染（单节点用各自的 NodeResizer）', () => {
    const { container } = render(
      <MultiSelectionScaler
        nodes={[makeNode('a', 0, 0, 200, 150)]}
        onScaleStart={vi.fn()}
        onScaleEnd={vi.fn()}
      />,
    )
    expect(container.children).toHaveLength(0)
  })

  it('未选中节点时不渲染', () => {
    const { container } = render(
      <MultiSelectionScaler
        nodes={[]}
        onScaleStart={vi.fn()}
        onScaleEnd={vi.fn()}
      />,
    )
    expect(container.children).toHaveLength(0)
  })

  it('包围盒覆盖所有选中节点的范围（含 padding）', () => {
    const { container } = render(
      <MultiSelectionScaler
        nodes={[makeNode('a', 0, 0, 200, 150), makeNode('b', 300, 200, 100, 100)]}
        onScaleStart={vi.fn()}
        onScaleEnd={vi.fn()}
      />,
    )
    const box = container.querySelector('[style*="dashed"]') as HTMLElement | null
    expect(box).not.toBeNull()
    const style = box!.getAttribute('style') ?? ''
    // 包围盒从 (0,0) 到 (400,300) 加 padding
    expect(style).toContain('left: -6px')
    expect(style).toContain('top: -6px')
    expect(style).toContain('width: 412px')
    expect(style).toContain('height: 312px')
  })
})
