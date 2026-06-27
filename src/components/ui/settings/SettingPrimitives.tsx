export function SettingRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm text-fg-primary">{label}</div>
        {description && <div className="text-xs text-fg-tertiary mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingGroup({ title, children }: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-medium mb-2 text-fg-primary">{title}</h3>
      <div className="divide-y divide-line-default">{children}</div>
    </section>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs mb-1 block text-fg-secondary">{children}</label>
}
