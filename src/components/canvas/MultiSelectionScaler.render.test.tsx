import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MultiSelectionScaler } from './MultiSelectionScaler'
import type { Node } from '@xyflow/react'

const makeNode = (id: string, x: number, y: number, w: number, h: number, selected = true, type = 'card'): Node => ({
  id,
  type,
  position: { x, y },
  width: w,
  height: h,
  selected,
  data: { cardId: id, color: 'white', width: w, height: h },
})

// 模拟 React Flow store：transform=[0,0,1]，nodes 为 Map，selector 由测试控制
const storeNodes = new Map<string, Node>()

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: vi.fn(),
    screenToFlowPosition: (p: { x: number; y: number }) => p,
    flowToScreenPosition: (p: { x: number; y: number }) => p,
  }),
  useStore: (selector: (s: unknown) => unknown) => selector({ nodes: storeNodes, transform: [0, 0, 1] }),
}))

describe('MultiSelectionScaler 渲染（内部订阅 store）', () => {
  it('选中 2 个节点时渲染包围盒虚线框与 4 个角手柄', () => {
    storeNodes.clear()
    storeNodes.set('a', makeNode('a', 0, 0, 200, 150))
    storeNodes.set('b', makeNode('b', 300, 200, 100, 100))
    const { container } = render(
      <MultiSelectionScaler onScaleStart={vi.fn()} onScaleEnd={vi.fn()} />,
    )
    expect(container.querySelectorAll('[style*="dashed"]')).toHaveLength(1)
    expect(container.querySelectorAll('[style*="resize"]')).toHaveLength(4)
  })

  it('选中 1 个节点时不渲染（单节点用各自的 NodeResizer）', () => {
    storeNodes.clear()
    storeNodes.set('a', makeNode('a', 0, 0, 200, 150))
    const { container } = render(
      <MultiSelectionScaler onScaleStart={vi.fn()} onScaleEnd={vi.fn()} />,
    )
    expect(container.children).toHaveLength(0)
  })

  it('选中节点不含 frame 类型（frame 有子布局不参与）', () => {
    storeNodes.clear()
    storeNodes.set('a', makeNode('a', 0, 0, 200, 150))
    storeNodes.set('f', makeNode('f', 0, 0, 600, 400, true, 'frame'))
    const { container } = render(
      <MultiSelectionScaler onScaleStart={vi.fn()} onScaleEnd={vi.fn()} />,
    )
    // 只有 1 个可缩放节点（frame 排除）→ 不渲染
    expect(container.children).toHaveLength(0)
  })

  it('包围盒覆盖所有选中节点的范围（含 padding）', () => {
    storeNodes.clear()
    storeNodes.set('a', makeNode('a', 0, 0, 200, 150))
    storeNodes.set('b', makeNode('b', 300, 200, 100, 100))
    const { container } = render(
      <MultiSelectionScaler onScaleStart={vi.fn()} onScaleEnd={vi.fn()} />,
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

  it('节点尺寸更新后包围盒跟随变化（不依赖选择时快照）', () => {
    storeNodes.clear()
    storeNodes.set('a', makeNode('a', 0, 0, 200, 150))
    storeNodes.set('b', makeNode('b', 300, 200, 100, 100))
    const first = render(
      <MultiSelectionScaler onScaleStart={vi.fn()} onScaleEnd={vi.fn()} />,
    )
    const box1 = first.container.querySelector('[style*="dashed"]') as HTMLElement
    expect(box1.getAttribute('style')).toContain('width: 412px')
    // 模拟节点被缩放：更新 store 中的尺寸，重新渲染
    storeNodes.set('b', makeNode('b', 300, 200, 250, 200))
    const second = render(
      <MultiSelectionScaler onScaleStart={vi.fn()} onScaleEnd={vi.fn()} />,
    )
    const box2 = second.container.querySelector('[style*="dashed"]') as HTMLElement
    expect(box2.getAttribute('style')).toContain('width: 562px')
    expect(box2.getAttribute('style')).toContain('height: 412px')
  })
})
