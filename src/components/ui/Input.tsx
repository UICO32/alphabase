import { forwardRef } from 'react'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: 'sm' | 'md'
  error?: string
  leftIcon?: React.ReactNode
}

const sizeClasses = {
  sm: 'pl-8 pr-3 py-1.5 text-xs',
  md: 'pl-9 pr-3 py-2 text-sm',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', error, leftIcon, className = '', ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full rounded-lg outline-none bg-surface-card text-text-primary border ${error ? 'border-border-danger' : 'border-border-default focus:border-accent-blue'} ${sizeClasses[inputSize]} ${className}`}
          {...props}
        />
        {error && (
          <span className="text-xs text-text-danger mt-1 block">{error}</span>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
