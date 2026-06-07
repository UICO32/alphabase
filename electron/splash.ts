import { BrowserWindow, screen } from 'electron'

let splashWindow: BrowserWindow | null = null

const SPLASH_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  body {
    margin: 0; padding: 0; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh;
    background: linear-gradient(160deg, hsl(220, 20%, 97%) 0%, hsl(0, 0%, 96%) 100%);
    color: hsl(0, 0%, 12%);
  }
  .spinner-row { display: flex; align-items: center; margin-bottom: 20px; }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid hsla(220, 15%, 85%, 0.6); border-top-color: #3b82f6;
    animation: spin 0.8s linear infinite; margin-right: 12px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .progress-track {
    width: 180px; height: 3px; border-radius: 2px;
    background: hsla(220, 15%, 85%, 0.5); overflow: hidden;
  }
  .progress-bar {
    width: 0%; height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    transition: width 0.3s ease;
  }
  .step-label { margin-top: 8px; font-size: 12px; color: hsl(0, 0%, 42%); }
  .credit { margin-top: 24px; font-size: 10px; color: hsl(0, 0%, 58%); }
</style>
</head>
<body>
  <div class="spinner-row">
    <div class="spinner"></div>
    <span style="font-weight:600;font-size:15px;letter-spacing:0.5px;">AlphaBase</span>
  </div>
  <div class="progress-track"><div class="progress-bar" id="bar"></div></div>
  <div class="step-label" id="label">正在启动...</div>
  <div class="credit">Created by UICO</div>
</body>
</html>`

export function createSplashWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const splashWidth = 400
  const splashHeight = 280

  splashWindow = new BrowserWindow({
    width: splashWidth,
    height: splashHeight,
    x: Math.round((screenWidth - splashWidth) / 2),
    y: Math.round((screenHeight - splashHeight) / 2),
    frame: false,
    transparent: false,
    resizable: false,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`)
  splashWindow.on('closed', () => { splashWindow = null })
  return splashWindow
}

export function updateSplashProgress(step: string, progress: number, total: number): void {
  if (!splashWindow) return
  const pct = total > 0 ? (progress / total) * 100 : 0
  splashWindow.webContents.executeJavaScript(
    `document.getElementById('bar').style.width='${pct}%';document.getElementById('label').textContent='${step.replace(/'/g, "\\'")}'`
  )
}

export function closeSplashWindow(): void {
  if (!splashWindow) return
  splashWindow.close()
  splashWindow = null
}
