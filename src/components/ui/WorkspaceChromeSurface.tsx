import type { CSSProperties } from 'react'

interface WorkspaceChromeSurfaceProps {
  top: number
  right: number
  bottom: number
  left: number
}

export function WorkspaceChromeSurface({ top, right, bottom, left }: WorkspaceChromeSurfaceProps) {
  const style = {
    '--workspace-chrome-top': `${top}px`,
    '--workspace-chrome-right': `${right}px`,
    '--workspace-chrome-bottom': `${bottom}px`,
    '--workspace-chrome-left': `${left}px`,
  } as CSSProperties

  return (
    <div className="workspace-chrome-surface" style={style} aria-hidden="true">
      <div className="workspace-chrome-strip workspace-chrome-strip-top" />
      <div className="workspace-chrome-strip workspace-chrome-strip-left" />
      <div className="workspace-chrome-strip workspace-chrome-strip-right" />
      <div className="workspace-chrome-strip workspace-chrome-strip-bottom" />
      <div className="workspace-chrome-corner workspace-chrome-corner-top-left" />
      <div className="workspace-chrome-corner workspace-chrome-corner-top-right" />
      <div className="workspace-chrome-corner workspace-chrome-corner-bottom-left" />
      <div className="workspace-chrome-corner workspace-chrome-corner-bottom-right" />
      <div className="workspace-canvas-aperture" />
    </div>
  )
}
