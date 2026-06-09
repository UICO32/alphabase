let container: HTMLDivElement | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function ensureContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container
  container = document.createElement('div')
  container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none'
  document.body.appendChild(container)
  return container
}

export function showToast(message: string, duration = 1500) {
  const el = document.createElement('div')
  el.textContent = message
  el.style.cssText = 'background:rgba(0,0,0,0.8);color:#fff;font-size:13px;padding:6px 14px;border-radius:6px;opacity:0;transform:translateY(8px);transition:opacity 0.15s,transform 0.15s;pointer-events:none;white-space:nowrap;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif'
  ensureContainer().appendChild(el)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(8px)'
    setTimeout(() => el.remove(), 150)
  }, duration)
}
