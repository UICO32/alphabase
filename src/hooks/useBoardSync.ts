import { useEffect, useRef } from 'react'
import { type Node, type Edge } from '@xyflow/react'

interface UseBoardSyncOptions {
  nodes: Node[]
  edges: Edge[]
}

export function useBoardSync({ nodes, edges }: UseBoardSyncOptions) {
  const prevNodesRef = useRef(nodes)
  const prevEdgesRef = useRef(edges)

  useEffect(() => {
    // TODO: 实现画板同步
    // 1. 监听 nodes/edges 变化
    // 2. debounce 600ms
    // 3. 转换为 BoardSnapshot 格式
    // 4. 写入 boards/<id>.json

    if (
      JSON.stringify(prevNodesRef.current) !== JSON.stringify(nodes) ||
      JSON.stringify(prevEdgesRef.current) !== JSON.stringify(edges)
    ) {
      console.log('Board changed, syncing...')
      prevNodesRef.current = nodes
      prevEdgesRef.current = edges
    }
  }, [nodes, edges])
}
