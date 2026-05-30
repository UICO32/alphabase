export function EmptyState({ icon, text }: {
  icon?: React.ReactNode
  text: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      {icon && (
        <div className="mb-3 text-text-secondary">
          {icon}
        </div>
      )}
      <div className="text-sm text-text-secondary">
        {text}
      </div>
    </div>
  )
}
