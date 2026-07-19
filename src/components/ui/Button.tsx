import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  selected?: boolean
}

const variantClasses = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-surface-panel text-fg-primary border border-line-default hover:bg-surface-card-hover hover:border-line-hover',
  ghost: 'text-fg-secondary hover:bg-surface-card-hover hover:text-fg-primary',
  danger: 'bg-[var(--fg-danger)] text-fg-inverse hover:brightness-110',
}

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, selected = false, className = '', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn-base interactive-control focus-ring inline-flex items-center justify-center rounded-lg font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        data-selected={selected || undefined}
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
