import { useMemo } from 'react'
import { useContourScene } from './useContourScene'
import { useClusterData } from './useClusterData'
import { useCardStore } from '../../stores/cardStore'
import { TopographyControls } from './TopographyControls'
import { TopographyScene } from './TopographyScene'

const DARK_BG = 0x00000f
const LIGHT_BG = 0xf5f5f0

const DARK_COLORS = {
  bg: DARK_BG, fog: 0x00000f, fogDensity: 0.018,
  ambientColor: 0x0a1530, ambientIntensity: 2,
  starColor: 0x3355aa,
  contourLine: 0xffffff, contourFill: 0x00060e,
  compassColor: 0xffcc00,
  labelBg: 'rgba(0,0,0,.72)', labelColor: 'rgba(255,255,255,.9)',
  textColor: 'rgba(255,180,0,0.6)', errorColor: 'rgba(255,80,80,0.8)',
}

const LIGHT_COLORS = {
  bg: LIGHT_BG, fog: 0xe8e8e3, fogDensity: 0.012,
  ambientColor: 0xffffff, ambientIntensity: 3,
  starColor: 0x9999aa,
  contourLine: 0x222222, contourFill: 0xe0e0d8,
  compassColor: 0xb8860b,
  labelBg: 'rgba(0,0,0,.72)', labelColor: 'rgba(255,255,255,.9)',
  textColor: 'rgba(120,80,0,0.7)', errorColor: 'rgba(200,60,60,0.8)',
}

export function TopographyView() {
  const { peaks, loading, error, needModel } = useClusterData()
  const sceneData = useContourScene(peaks)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const C = isDark ? DARK_COLORS : LIGHT_COLORS

  const cardsObj = useCardStore(s => s.cards)
  const stats = useMemo(() => {
    const cardIds = Object.keys(cardsObj)
    let days = 0
    if (cardIds.length > 0) {
      const now = Date.now()
      let earliest = now
      for (const id of cardIds) {
        const t = cardsObj[id]?.createdAt
        if (t && t < earliest) earliest = t
      }
      days = Math.max(1, Math.ceil((now - earliest) / 86400000))
    }
    return { cardCount: cardIds.length, days }
  }, [cardsObj])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: `#${C.bg.toString(16).padStart(6, '0')}` }}>
      <style>{`
        @keyframes topography-spin { to { transform: rotate(360deg); } }
        @keyframes topography-pulse { 0%,100% { opacity: 0.4; transform: translateX(0); } 50% { opacity: 1; transform: translateX(270%); } }
      `}</style>
      <TopographyScene peaks={peaks} sceneData={sceneData} colors={C} />
      <TopographyControls
        peaks={peaks}
        cardCount={stats.cardCount}
        days={stats.days}
        needModel={needModel}
        isDark={!!isDark}
        colors={C}
      />
      {loading && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: C.textColor, fontSize: 11, letterSpacing: 7, zIndex: 5,
          fontFamily: 'Courier New, monospace',
        }}>
          LOADING TOPOGRAPHY...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          color: C.errorColor, fontSize: 10, zIndex: 5,
          fontFamily: 'Courier New, monospace',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
