/**
 * Topography UI controls: stats dashboard, index button, model download
 * overlay, and loading/error states.
 *
 * Extracted from TopographyView.tsx as part of R1 component split.
 * Pure presentational — receives all data via props.
 */

import { useEmbeddingStore } from '../../stores/embeddingStore'

const DIN_FONT = "'DIN Alternate', 'DIN 1451', DIN, Oswald, 'Helvetica Neue', sans-serif"

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{
        fontFamily: DIN_FONT, fontSize: 52, fontWeight: 200,
        color: '#000', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        letterSpacing: -1,
      }}>{value}</span>
      <span style={{
        fontFamily: DIN_FONT, fontSize: 13, fontWeight: 200,
        color: 'rgba(0,0,0,0.5)', lineHeight: 1, letterSpacing: 1,
      }}>{label}</span>
    </div>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 32, background: 'rgba(0,0,0,0.12)' }} />
}

interface TopographyControlsProps {
  peaks: { length: number }
  cardCount: number
  days: number
  needModel: boolean
  isDark: boolean
  colors: {
    bg: number
    compassColor: number
    textColor: string
    errorColor: string
  }
}

export function TopographyControls({ peaks, cardCount, days, needModel, isDark, colors: C }: TopographyControlsProps) {
  const { downloading, downloadProgress, downloadModel, indexing, startIndexing, progress, total } = useEmbeddingStore()

  const handleRefresh = () => {
    if (indexing || downloading) return
    void startIndexing()
  }

  const indexPct = total > 0 ? Math.min(Math.round((progress / total) * 100), 100) : 0
  const indexIndeterminate = indexing && total === 0

  return (
    <>
      {/* Top-center data dashboard + manual index button */}
      {(!needModel && !downloading) && (
      <div style={{
        position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          <Stat value={cardCount} label="张卡片" />
          <Sep />
          <Stat value={peaks.length} label="个主题" />
          <Sep />
          <Stat value={days} label="天记录" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
          <button onClick={handleRefresh} disabled={indexing || downloading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: indexing ? 'rgba(20,20,20,0.5)' : '#0a0a0a',
              color: '#fff', border: 'none', borderRadius: 999, padding: '8px 16px',
              cursor: indexing ? 'wait' : 'pointer',
              fontFamily: DIN_FONT, fontSize: 11, fontWeight: 400,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              style={{ animation: indexing ? 'topography-spin 0.9s linear infinite' : 'none' }}>
              <path d="M21 12a9 9 0 1 1-3-6.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {indexing ? '索引中' : '索引卡片'}
          </button>
          {indexing && (
            <div style={{ width: 180, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
              {indexIndeterminate ? (
                <div style={{ width: '40%', height: '100%', background: C.compassColor,
                  animation: 'topography-pulse 1.2s ease-in-out infinite' }} />
              ) : (
                <div style={{ width: `${indexPct}%`, height: '100%', background: C.compassColor,
                  transition: 'width .3s ease' }} />
              )}
            </div>
          )}
        </div>
      </div>
      )}
      {/* Model download overlay */}
      {(needModel || downloading) && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          background: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)',
          borderRadius: 16, padding: '32px 40px', maxWidth: 340, textAlign: 'center',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textColor, fontFamily: DIN_FONT }}>
            向量模型未就绪
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}>
            3D 地形图需要本地向量模型来聚类卡片。下载模型（约 120MB）后即可自动索引。
          </div>
          <button onClick={() => void downloadModel()} disabled={downloading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: downloading ? 'rgba(20,20,20,0.5)' : '#0a0a0a',
              color: '#fff', border: 'none', borderRadius: 999, padding: '10px 20px',
              cursor: downloading ? 'wait' : 'pointer',
              fontFamily: DIN_FONT, fontSize: 12, fontWeight: 500,
            }}>
            {downloading ? `下载中 ${Math.round(downloadProgress || 0)}%` : '下载模型'}
          </button>
          {downloading && (
            <div style={{ width: 220, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(downloadProgress || 0)}%`, height: '100%', background: C.compassColor, transition: 'width .3s ease' }} />
            </div>
          )}
        </div>
      )}
    </>
  )
}
