import { Search } from 'lucide-react'

export function SearchInput({ value, onChange, placeholder }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-secondary"
        size={16}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none bg-surface-card text-fg-primary border border-line-default"
      />
    </div>
  )
}
