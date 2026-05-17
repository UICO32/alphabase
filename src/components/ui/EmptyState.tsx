import { getPanelSurface } from '../../theme'

export function EmptyState({ icon, text, surface }: {
  icon?: React.ReactNode
  text: string
  surface: ReturnType<typeof getPanelSurface>
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      {icon && (
        <div className="mb-3" style={{ color: surface.muted }}>
          {icon}
        </div>
      )}
      <div className="text-sm" style={{ color: surface.muted }}>
        {text}
      </div>
    </div>
  )
}
