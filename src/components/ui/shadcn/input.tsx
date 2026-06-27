import * as React from 'react'
import { cn } from '../../../lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-line-default bg-surface-input px-3 py-2 text-sm text-fg-primary transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-fg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
