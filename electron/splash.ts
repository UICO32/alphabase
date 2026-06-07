import { BrowserWindow, screen } from 'electron'

let splashWindow: BrowserWindow | null = null

// Lightweight animation helpers — no external deps, works offline
// Approximates GSAP's back.out(1.7) via cubic-bezier and stagger via animation-delay
const SPLASH_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh;
    background: #0a0a0b;
    color: #e4e4e7;
    overflow: hidden;
  }
  .title {
    font-weight: 700; font-size: 22px; letter-spacing: 3px;
    margin-bottom: 14px;
  }
  .title-char {
    display: inline-block;
    opacity: 0;
    transform: translateY(12px) scale(0.85);
    animation: charReveal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes charReveal {
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .subtitle {
    font-size: 11px; color: #52525b; letter-spacing: 4px;
    margin-bottom: 24px;
    opacity: 0;
    transform: translateY(6px);
    animation: fadeSlideIn 0.35s 0.75s ease forwards;
  }
  @keyframes fadeSlideIn {
    to { opacity: 0.55; transform: translateY(0); }
  }
  .progress-dots {
    display: flex; gap: 6px;
    margin-bottom: 14px;
  }
  .dot {
    width: 4px; height: 4px; border-radius: 50%;
    background: #27272a;
    opacity: 0;
    animation: dotAppear 0.25s ease forwards;
    transition: background 0.25s, transform 0.25s, box-shadow 0.25s;
  }
  .dot.filled {
    background: #3b82f6;
    transform: scale(1.3);
    box-shadow: 0 0 6px rgba(59,130,246,0.4);
  }
  .dot.complete {
    background: #22c55e;
    transform: scale(1);
    box-shadow: 0 0 3px rgba(34,197,94,0.25);
  }
  @keyframes dotAppear {
    from { opacity: 0; transform: scale(0); }
    to { opacity: 1; transform: scale(1); }
  }
  .step-label {
    font-size: 13px; color: #71717a;
    text-align: center;
    min-height: 18px;
  }
  .step-label.active { color: #e4e4e7; }
  .credit {
    margin-top: 28px; font-size: 10px; color: #3f3f46; letter-spacing: 0.5px;
    opacity: 0;
    animation: fadeIn 0.3s 1.3s ease forwards;
  }
  @keyframes fadeIn {
    to { opacity: 0.3; }
  }
</style>
</head>
<body>
  <div class="title" id="title"></div>
  <div class="subtitle">KNOWLEDGE CANVAS</div>
  <div class="progress-dots">
    <div class="dot" data-i="0" style="animation-delay:0.85s"></div>
    <div class="dot" data-i="1" style="animation-delay:0.9s"></div>
    <div class="dot" data-i="2" style="animation-delay:0.95s"></div>
    <div class="dot" data-i="3" style="animation-delay:1.0s"></div>
    <div class="dot" data-i="4" style="animation-delay:1.05s"></div>
  </div>
  <div class="step-label" id="stepLabel">正在启动...</div>
  <div class="credit">Designed by UICO</div>
  <script>
    var steps = ['初始化工作区', '加载卡片数据', '加载画板快照', '恢复回收站', '准备就绪'];
    var titleText = 'AlphaBase';
    var titleEl = document.getElementById('title');
    for (var i = 0; i < titleText.length; i++) {
      var span = document.createElement('span');
      span.className = 'title-char';
      span.textContent = titleText[i];
      span.style.animationDelay = (i * 0.055) + 's';
      titleEl.appendChild(span);
    }
    function activateStep(n) {
      var label = document.getElementById('stepLabel');
      label.classList.remove('active');
      var dots = document.querySelectorAll('.dot');
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.remove('filled', 'complete');
        if (i < n) dots[i].classList.add('complete');
        else if (i === n) dots[i].classList.add('filled');
      }
      if (n >= 0 && n < steps.length) {
        label.textContent = steps[n];
        label.classList.add('active');
        label.style.animation = 'none';
        label.offsetHeight;
        label.style.animation = 'fadeSlideIn 0.2s ease forwards';
      } else {
        label.textContent = '正在启动...';
      }
    }
  </script>
</body>
</html>`

export function createSplashWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const splashWidth = 380
  const splashHeight = 260

  splashWindow = new BrowserWindow({
    width: splashWidth,
    height: splashHeight,
    x: Math.round((screenWidth - splashWidth) / 2),
    y: Math.round((screenHeight - splashHeight) / 2),
    frame: false,
    transparent: false,
    resizable: false,
    show: true,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`)
  splashWindow.on('closed', () => { splashWindow = null })
  return splashWindow
}

export function updateSplashProgress(_step: string, progress: number, total: number): void {
  if (!splashWindow) return
  const stepIndex = Math.min(progress, total)
  splashWindow.webContents.executeJavaScript(
    `activateStep(${stepIndex})`
  )
}

export function closeSplashWindow(): void {
  if (!splashWindow) return
  splashWindow.close()
  splashWindow = null
}