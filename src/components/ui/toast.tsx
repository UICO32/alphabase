import { createRoot } from 'react-dom/client'

let toastContainer: HTMLDivElement | null = null
let toastRoot: ReturnType<typeof createRoot> | null = null

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'global-toast-container'
    toastContainer.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:8px'
    document.body.appendChild(toastContainer)
    toastRoot = createRoot(toastContainer)
  }
  return toastRoot!
}

interface ToastItem {
  id: number
  message: string
}

let toastCounter = 0

function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            fontSize: '13px',
            padding: '8px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'toast-in 0.2s ease-out',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {t.message}
        </div>
      ))}
    </>
  )
}

export function showToast(message: string, duration = 1500) {
  const id = ++toastCounter
  const root = getToastContainer()

  const render = (items: ToastItem[]) => {
    root.render(<ToastContainer toasts={items} />)
  }

  // Add this toast
  activeToasts.push({ id, message })
  render([...activeToasts])

  setTimeout(() => {
    const idx = activeToasts.findIndex((t) => t.id === id)
    if (idx >= 0) activeToasts.splice(idx, 1)
    render([...activeToasts])
  }, duration)
}

const activeToasts: ToastItem[] = []
