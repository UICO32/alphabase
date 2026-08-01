import { createContext } from 'react'

/**
 * 是否处于"多选"状态（选中节点 > 1）。
 * 由 ReactFlowCanvas 统一计算（一次 filter），节点组件通过 context 消费，
 * 避免每张卡在每次 store 更新时各自 filter 全部节点（大画布 O(n²) 开销）。
 */
export const MultiSelectContext = createContext(false)
