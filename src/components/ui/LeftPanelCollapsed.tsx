import { usePanelStore } from '../../stores/panelStore'
import { ArrowRightToLine } from 'lucide-react'

export function LeftPanelCollapsed() {
  const setLeftPanelCollapsed = usePanelStore(s => s.setLeftPanelCollapsed)

  return (
    <button
      onClick={() => setLeftPanelCollapsed(false)}
      className="btn-base fixed top-1/2 -translate-y-1/2 left-0 z-50 flex items-center justify-center w-6 h-12 rounded-r-lg hover:shadow-lg glass-panel text-fg-primary"
      style={{
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <ArrowRightToLine size={14} />
    </button>
  )
}
