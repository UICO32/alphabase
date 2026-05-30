import { forwardRef } from 'react'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  variant?: 'default' | 'ghost'
}

const sizeClasses = {
  sm: 'p-1.5 rounded-md',
  md: 'p-2 rounded-lg',
}

const variantClasses = {
  default: 'text-text-primary hover:bg-surface-card-hover',
  ghost: 'text-text-secondary hover:bg-surface-card-hover hover:text-text-primary',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'default', className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn-base inline-flex items-center justify-center transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      />
    )
  },
)

IconButton.displayName = 'IconButton'
