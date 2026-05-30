export function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b border-border-default transition-theme"
    >
      <span className="font-medium text-sm text-text-primary">
        {title}
      </span>
      {children}
    </div>
  )
}
