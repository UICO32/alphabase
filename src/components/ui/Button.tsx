import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses = {
  primary: 'bg-accent-blue text-text-inverse hover:opacity-90',
  secondary: 'bg-surface-card text-text-primary border border-border-default hover:bg-surface-card-hover',
  ghost: 'text-text-secondary hover:bg-surface-card-hover hover:text-text-primary',
  danger: 'bg-accent-red text-text-inverse hover:opacity-90',
}

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, className = '', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn-base inline-flex items-center justify-center rounded-lg font-medium transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : leftIcon}
        {children}
        {rightIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
