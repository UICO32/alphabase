import { Button } from './Button'

export function SideTabButton({ active, children, onClick, title }: {
  active: boolean
  children: React.ReactNode
  onClick?: () => void
  title?: string
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      title={title}
      className={`${active ? 'bg-surface-card text-text-primary' : 'text-text-secondary'}`}
    >
      {children}
    </Button>
  )
}

export function PanelButton({ variant = 'secondary', size = 'md', icon, children, ...props }: {
  onClick?: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  disabled?: boolean
  className?: string
  title?: string
}) {
  return (
    <Button
      variant={variant}
      size={size === 'lg' ? 'md' : size}
      leftIcon={icon}
      {...props}
    >
      {children}
    </Button>
  )
}
