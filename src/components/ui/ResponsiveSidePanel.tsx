import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { CSSProperties, RefObject, ReactNode, WheelEventHandler } from 'react'
import type { PanelSide, WorkspaceLayoutMode } from '../../hooks/workspaceLayout'

interface ResponsiveSidePanelProps {
  side: PanelSide
  mode: WorkspaceLayoutMode
  open: boolean
  width: number
  label: string
  triggerRef?: RefObject<HTMLButtonElement>
  panelRef?: RefObject<HTMLDivElement>
  className?: string
  style?: CSSProperties
  onOpenChange: (open: boolean) => void
  onWheel?: WheelEventHandler<HTMLDivElement>
  children: ReactNode
}

export function ResponsiveSidePanel({
  side,
  mode,
  open,
  width,
  label,
  triggerRef,
  panelRef,
  className = '',
  style,
  onOpenChange,
  onWheel,
  children,
}: ResponsiveSidePanelProps) {
  if (mode === 'narrow') {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="workspace-drawer-overlay" />
          <DialogPrimitive.Content
            ref={panelRef}
            className={`workspace-drawer workspace-drawer-${side} ${className}`}
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              if (!triggerRef) return
              event.preventDefault()
              requestAnimationFrame(() => triggerRef.current?.focus())
            }}
            onWheel={onWheel}
          >
            <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )
  }

  return (
    <div
      ref={panelRef}
      className={`absolute top-0 bottom-0 z-10 ${side === 'left' ? 'left-0' : 'right-0'} ${className}`}
      style={{
        width,
        transform: `translateX(${open ? 0 : side === 'left' ? -width : width}px)`,
        ...style,
      }}
      onWheel={onWheel}
    >
      {children}
    </div>
  )
}
