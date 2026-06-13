import type { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem as ShadcnContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/shadcn/context-menu'

export interface ContextMenuItem {
  icon?: ReactNode
  label?: string
  onClick?: () => void
  type?: 'separator'
  danger?: boolean
}

interface ContextMenuWrapperProps {
  children: ReactNode
  items: ContextMenuItem[]
}

export function ContextMenuWrapper({ children, items }: ContextMenuWrapperProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((item, i) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={i} />
          ) : (
            <ShadcnContextMenuItem
              key={i}
              onClick={item.onClick}
              className={item.danger ? 'text-destructive focus:text-destructive' : ''}
            >
              {item.icon}
              <span>{item.label}</span>
            </ShadcnContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
