import { Handle, Position } from '@xyflow/react'

const handleClassName = '!opacity-0 !pointer-events-none !w-3 !h-3 !border-0'

export function CardHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" className={handleClassName} style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClassName} style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }} />
      <Handle type="source" position={Position.Left} id="left" className={handleClassName} style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Right} id="right" className={handleClassName} style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }} />
      <Handle type="target" position={Position.Top} id="top-target" className={handleClassName} style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={handleClassName} style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }} />
      <Handle type="target" position={Position.Left} id="left-target" className={handleClassName} style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" position={Position.Right} id="right-target" className={handleClassName} style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }} />
    </>
  )
}