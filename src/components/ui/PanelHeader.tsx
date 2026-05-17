import { usePanelSurface } from '../../hooks/usePanelSurface'

export function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const surface = usePanelSurface()

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b transition-theme"
      style={{ borderColor: surface.divider }}
    >
      <span className="font-medium text-sm" style={{ color: surface.text }}>
        {title}
      </span>
      {children}
    </div>
  )
}
