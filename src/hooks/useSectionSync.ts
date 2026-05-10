import { useEffect, useRef } from 'react'
import { type Node } from '@xyflow/react'

interface UseSectionSyncOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

export function useSectionSync({ nodes, setNodes }: UseSectionSyncOptions) {
  const prevNodesRef = useRef<Node[]>(nodes)

  useEffect(() => {
    const prevNodes = prevNodesRef.current
    const sectionNodes = nodes.filter((n) => n.type === 'section')

    let hasChanges = false
    const updatedNodes = nodes.map((node) => {
      for (const section of sectionNodes) {
        const prevSection = prevNodes.find((n) => n.id === section.id)
        if (!prevSection) continue

        const dx = section.position.x - prevSection.position.x
        const dy = section.position.y - prevSection.position.y

        if (dx === 0 && dy === 0) continue

        if (node.type === 'card') {
          const nodeX = node.position.x
          const nodeY = node.position.y
          const sectionX = section.position.x
          const sectionY = section.position.y
          const sectionW = (section.data?.width as number) ?? 400
          const sectionH = (section.data?.height as number) ?? 300

          if (
            nodeX >= sectionX &&
            nodeX <= sectionX + sectionW &&
            nodeY >= sectionY &&
            nodeY <= sectionY + sectionH
          ) {
            hasChanges = true
            return {
              ...node,
              position: {
                x: node.position.x + dx,
                y: node.position.y + dy,
              },
            }
          }
        }
      }
      return node
    })

    if (hasChanges) {
      setNodes(updatedNodes)
    }

    prevNodesRef.current = nodes
  }, [nodes, setNodes])
}
