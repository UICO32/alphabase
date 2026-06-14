import { useMemo } from 'react'

interface SkeletonScreenProps {
  stepText?: string
  progress?: number // 0-100
}

const CARD_SKELETONS = [
  { x: 60, y: 80, w: 140, h: 90, opacity: 0.7 },
  { x: 280, y: 160, w: 140, h: 90, opacity: 0.7 },
  { x: 500, y: 60, w: 140, h: 90, opacity: 0.7 },
  { x: 180, y: 320, w: 140, h: 90, opacity: 0.7 },
  { x: 420, y: 280, w: 100, h: 65, opacity: 0.4 },
  { x: 620, y: 200, w: 100, h: 65, opacity: 0.4 },
  { x: 80, y: 240, w: 100, h: 65, opacity: 0.4 },
]

export function SkeletonScreen({ stepText = '', progress = 0 }: SkeletonScreenProps) {
  const styleTag = useMemo(() => (
    <style>{`
      @keyframes skeletonPulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes cardPulse {
        0% { background-position: 200% 200%; }
        100% { background-position: -200% -200%; }
      }

      .sk-root {
        display: flex;
        width: 100vw;
        height: 100vh;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        overflow: hidden;
      }

      /* --- theme variables --- */
      .sk-root {
        --surface-panel: #f5f5f4;
        --surface-app: #fafaf9;
        --border-subtle: #e7e5e4;
        --skeleton-bar-from: #e7e5e4;
        --skeleton-bar-mid: #f0efee;
        --skeleton-bar-to: #e7e5e4;
        --card-skeleton-from: #e7e5e4;
        --card-skeleton-mid: #f0efee;
        --card-skeleton-to: #e7e5e4;
        --text-muted: #a8a29e;
        --progress-bg: #e7e5e4;
        --progress-fill: #18181b;
      }
      [data-theme="dark"] .sk-root {
        --surface-panel: #27272a;
        --surface-app: #18181b;
        --border-subtle: #3f3f46;
        --skeleton-bar-from: #3f3f46;
        --skeleton-bar-mid: #52525b;
        --skeleton-bar-to: #3f3f46;
        --card-skeleton-from: #3f3f46;
        --card-skeleton-mid: #52525b;
        --card-skeleton-to: #3f3f46;
        --text-muted: #71717a;
        --progress-bg: #3f3f46;
        --progress-fill: #e4e4e7;
      }

      /* --- panels --- */
      .sk-left-panel {
        width: 260px;
        min-width: 260px;
        background: var(--surface-panel);
        display: flex;
        flex-direction: column;
        padding: 0;
      }
      .sk-right-panel {
        width: 360px;
        min-width: 360px;
        background: var(--surface-panel);
        display: flex;
        flex-direction: column;
        padding: 0;
      }
      .sk-canvas {
        flex: 1;
        background: var(--surface-app);
        position: relative;
      }

      /* --- separators --- */
      .sk-sep {
        width: 1px;
        background: var(--border-subtle);
        flex-shrink: 0;
      }

      /* --- skeleton bar --- */
      .sk-bar {
        background: linear-gradient(90deg, var(--skeleton-bar-from) 25%, var(--skeleton-bar-mid) 50%, var(--skeleton-bar-to) 75%);
        background-size: 200% 100%;
        animation: skeletonPulse 1.8s ease-in-out infinite;
        border-radius: 3px;
      }

      /* --- card skeleton --- */
      .sk-card {
        background: linear-gradient(135deg, var(--card-skeleton-from) 0%, var(--card-skeleton-mid) 40%, var(--card-skeleton-to) 80%);
        background-size: 200% 200%;
        animation: cardPulse 2s ease-in-out infinite;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        border-radius: 8px;
        position: absolute;
      }

      /* --- progress bar (in canvas center) --- */
      .sk-progress-track {
        width: 140px;
        height: 3px;
        background: var(--progress-bg);
        border-radius: 2px;
        overflow: hidden;
      }
      .sk-progress-fill {
        height: 100%;
        background: var(--progress-fill);
        border-radius: 2px;
        transition: width 0.4s ease;
      }
      .sk-step-text {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 8px;
        animation: stepBreathe 2s ease-in-out infinite alternate;
      }
      @keyframes stepBreathe {
        0% { opacity: 0.5; }
        100% { opacity: 1; }
      }

      /* --- left panel internals --- */
      .sk-lp-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
      }
      .sk-lp-icon {
        width: 16px;
        height: 16px;
        border-radius: 3px;
      }
      .sk-lp-header-text {
        flex: 1;
        height: 12px;
      }
      .sk-lp-tabs {
        display: flex;
        gap: 0;
        padding: 0 14px;
        margin-top: 4px;
      }
      .sk-lp-tab {
        height: 10px;
        border-radius: 3px;
      }
      .sk-lp-sep {
        height: 1px;
        background: var(--border-subtle);
        margin: 10px 14px;
      }
      .sk-lp-list {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 0 14px;
      }
      .sk-lp-item {
        height: 32px;
        border-radius: 6px;
      }
      .sk-lp-trash {
        border-top: 1px solid var(--border-subtle);
        padding: 10px 14px;
      }
      .sk-lp-trash-bar {
        height: 32px;
        width: 100%;
        border-radius: 6px;
      }

      /* --- right panel internals --- */
      .sk-rp-tabs {
        display: flex;
        align-items: center;
        gap: 0;
        padding: 10px 14px;
        border-bottom: 1px solid var(--border-subtle);
      }
      .sk-rp-tab {
        height: 10px;
        border-radius: 3px;
      }
      .sk-rp-collapse {
        width: 16px;
        height: 16px;
        border-radius: 3px;
        margin-left: auto;
      }
      .sk-rp-content {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sk-rp-title {
        height: 14px;
        width: 80%;
      }
      .sk-rp-meta {
        height: 10px;
        width: 60%;
      }
      .sk-rp-editor {
        height: 200px;
        width: 100%;
        border-radius: 8px;
      }
      .sk-rp-ai-label {
        height: 10px;
        width: 50px;
      }
      .sk-rp-ai-line {
        height: 10px;
        width: 100%;
      }
    `}</style>
  ), [])

  return (
    <div className="sk-root">
      {styleTag}

      {/* Left Panel */}
      <div className="sk-left-panel">
        <div className="sk-lp-header">
          <div className="sk-lp-icon sk-bar" />
          <div className="sk-lp-header-text sk-bar" />
          <div className="sk-lp-icon sk-bar" />
        </div>
        <div className="sk-lp-tabs">
          <div className="sk-lp-tab sk-bar" style={{ width: 48, marginRight: 12 }} />
          <div className="sk-lp-tab sk-bar" style={{ width: 36 }} />
        </div>
        <div className="sk-lp-sep" />
        <div className="sk-lp-list">
          <div className="sk-lp-item sk-bar" />
          <div className="sk-lp-item sk-bar" />
          <div className="sk-lp-item sk-bar" />
          <div className="sk-lp-item sk-bar" />
        </div>
        <div className="sk-lp-trash">
          <div className="sk-lp-trash-bar sk-bar" />
        </div>
      </div>

      <div className="sk-sep" />

      {/* Canvas */}
      <div className="sk-canvas">
        {/* Scattered card skeletons */}
        {CARD_SKELETONS.map((c, i) => (
          <div
            key={i}
            className="sk-card"
            style={{
              left: c.x,
              top: c.y,
              width: c.w,
              height: c.h,
              opacity: c.opacity,
            }}
          />
        ))}
      </div>

      <div className="sk-sep" />

      {/* Right Panel */}
      <div className="sk-right-panel">
        <div className="sk-rp-tabs">
          <div className="sk-rp-tab sk-bar" style={{ width: 42, marginRight: 16 }} />
          <div className="sk-rp-tab sk-bar" style={{ width: 52, marginRight: 16 }} />
          <div className="sk-rp-collapse sk-bar" />
        </div>
        <div className="sk-rp-content">
          <div className="sk-rp-title sk-bar" />
          <div className="sk-rp-meta sk-bar" />
          <div className="sk-rp-editor sk-bar" />
          <div className="sk-rp-ai-label sk-bar" />
          <div className="sk-rp-ai-line sk-bar" style={{ width: '90%' }} />
          <div className="sk-rp-ai-line sk-bar" style={{ width: '70%' }} />
          <div className="sk-rp-ai-line sk-bar" style={{ width: '50%' }} />
        </div>
      </div>
    </div>
  )
}
