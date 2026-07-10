import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '../../../lib/utils'

type ToggleGroupProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & {
  style?: React.CSSProperties
}

function ToggleGroup({ className, children, style, ...props }: ToggleGroupProps) {
  const items = React.Children.toArray(children)
  const { value, defaultValue } = props as {
    value?: string | string[]
    defaultValue?: string | string[]
  }
  const selectedValue = Array.isArray(value)
    ? value[0]
    : value ?? (Array.isArray(defaultValue) ? defaultValue[0] : defaultValue)
  const activeIndex = Math.max(
    0,
    items.findIndex((child) =>
      React.isValidElement(child) && child.props.value === selectedValue
    )
  )

  return (
    <ToggleGroupPrimitive.Root
      className={cn('segmented flex', className)}
      style={{
        '--seg-count': items.length,
        '--active-index': activeIndex,
        ...style,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn('segmented-item flex-1 cursor-pointer', className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
