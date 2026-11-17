import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TextAnnotationNode } from './TextAnnotationNode'
import { useFrameInteraction } from './utils/frameInteraction'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** NodeProps 里画布注入的运行时字段太多，测试只给渲染所需的最小集合。 */
const TextNode = TextAnnotationNode as unknown as ComponentType<Record<string, unknown>>

function annotationProps(content = ''): Record<string, unknown> {
  return {
    id: 'anno-1',
    type: 'text',
    data: { content },
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  }
}

function renderAnnotation(autoEditAnnoId: string | null, content = '') {
  useFrameInteraction.setState({ autoEditAnnoId })
  return render(
    <ReactFlowProvider>
      <TextNode {...annotationProps(content)} />
    </ReactFlowProvider>,
  )
}

function annotationTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText('文本注释') as HTMLTextAreaElement
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  cleanup()
  useFrameInteraction.setState({ autoEditAnnoId: null, textToolMode: false })
  vi.unstubAllGlobals()
})

describe('TextAnnotationNode 自动编辑', () => {
  it('放置文本后进入编辑态并清理 autoEdit 标记', () => {
    renderAnnotation('anno-1')

    expect(useFrameInteraction.getState().autoEditAnnoId).toBeNull()
    expect(annotationTextarea().readOnly).toBe(false)
  })

  it('没有 autoEdit 标记时保持只读，且不会误清理别的标记', () => {
    renderAnnotation(null)

    expect(useFrameInteraction.getState().autoEditAnnoId).toBeNull()
    expect(annotationTextarea().readOnly).toBe(true)

    cleanup()
    renderAnnotation('other-anno')
    expect(useFrameInteraction.getState().autoEditAnnoId).toBe('other-anno')
  })

  it('标记只消费一次，重复渲染不会重新进入编辑', () => {
    const view = renderAnnotation('anno-1')
    expect(useFrameInteraction.getState().autoEditAnnoId).toBeNull()

    // 模拟组件因其它状态更新重新渲染：标记已消费，不应再次触发。
    view.rerender(
      <ReactFlowProvider>
        <TextNode {...annotationProps()} />
      </ReactFlowProvider>,
    )

    expect(useFrameInteraction.getState().autoEditAnnoId).toBeNull()
    expect(annotationTextarea().readOnly).toBe(false)
  })
})
