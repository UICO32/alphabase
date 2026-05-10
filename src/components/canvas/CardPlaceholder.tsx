import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

export interface CardPlaceholderData extends Record<string, unknown> {
  width?: number
  height?: number
}

type PlaceholderNodeType = Node<CardPlaceholderData, 'placeholder'>

export const CardPlaceholder = memo(({ data }: NodeProps<PlaceholderNodeType>) => {
  return (
    <div
      className="rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white/50"
      style={{
        width: data.width ?? 280,
        height: data.height ?? 60,
      }}
    >
      <span className="text-gray-400 text-sm">Drop card here</span>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  )
})

CardPlaceholder.displayName = 'CardPlaceholder'
