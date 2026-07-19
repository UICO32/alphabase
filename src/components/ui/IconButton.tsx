import { forwardRef } from 'react'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  variant?: 'default' | 'ghost'
  selected?: boolean
}

const sizeClasses = {
  sm: 'p-1.5 rounded-md',
  md: 'p-2 rounded-lg',
}

const variantClasses = {
  default: 'text-fg-primary hover:bg-surface-card-hover',
  ghost: 'text-fg-secondary hover:bg-surface-card-hover hover:text-fg-primary',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'default', selected = false, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn-base interactive-control focus-ring inline-flex items-center justify-center ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        data-selected={selected || undefined}
        {...props}
      />
    )
  },
)

IconButton.displayName = 'IconButton'
