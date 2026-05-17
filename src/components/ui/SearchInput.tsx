import { Search } from 'lucide-react'
import { usePanelSurface } from '../../hooks/usePanelSurface'

export function SearchInput({ value, onChange, placeholder }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const surface = usePanelSurface()

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        size={16}
        style={{ color: surface.muted }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
        style={{
          backgroundColor: surface.surface,
          color: surface.text,
          border: `1px solid ${surface.divider}`,
        }}
      />
    </div>
  )
}
