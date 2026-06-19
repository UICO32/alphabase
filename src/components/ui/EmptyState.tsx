export function EmptyState({ icon, text }: {
  icon?: React.ReactNode
  text: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      {icon && (
        <div className="mb-3 text-fg-tertiary/60">
          {icon}
        </div>
      )}
      <div className="text-sm text-fg-secondary/90 max-w-[220px] leading-relaxed">
        {text}
      </div>
    </div>
  )
}
