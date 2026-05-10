import { useEffect, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'
interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
}

export function useWorkspaceLifecycle({ setNodes, setEdges }: UseWorkspaceLifecycleOptions) {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // TODO: 实现工作区生命周期
    // 1. 尝试恢复上次工作区
    // 2. 加载卡片到 cardStore
    // 3. 加载画板列表
    // 4. 加载首个画板 snapshot → setNodes/setEdges
    // 5. 启动 syncEngine

    console.log('Workspace lifecycle initialized')
  }, [setNodes, setEdges])
}
