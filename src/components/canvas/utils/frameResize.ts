/**
 * Pure resize computation for FrameNode.
 *
 * Extracted from FrameNode.tsx as part of R2 component split.
 * All functions are pure and easily testable.
 */

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface ResizeResult {
  width: number
  height: number
  /** 原点（左上角）相对拖动起点的位移。西/北边被拖动时原点跟着移动。 */
  offsetX: number
  offsetY: number
}

const MIN_WIDTH = 300
const MIN_HEIGHT = 200

/**
 * Compute the new frame geometry given a resize direction,
 * mouse delta (in canvas coordinates, already zoom-adjusted),
 * and the starting dimensions.
 *
 * 只改尺寸不改原点会让拖西/北边时框朝反方向增长，所以这里同时给出原点位移：
 * 东、南边拖动只改尺寸；西、北边拖动时原点跟随被拖动的边。
 * 夹紧到最小尺寸后，尺寸不再变化的部分不会作用到原点（否则会越界抖动）。
 */
export function computeResize(
  dir: ResizeDir,
  dx: number,
  dy: number,
  startW: number,
  startH: number,
): ResizeResult {
  let width = startW
  let height = startH
  if (dir.includes('e')) width = Math.max(MIN_WIDTH, startW + dx)
  if (dir.includes('s')) height = Math.max(MIN_HEIGHT, startH + dy)
  if (dir.includes('w')) width = Math.max(MIN_WIDTH, startW - dx)
  if (dir.includes('n')) height = Math.max(MIN_HEIGHT, startH - dy)

  return {
    width,
    height,
    offsetX: dir.includes('w') ? startW - width : 0,
    offsetY: dir.includes('n') ? startH - height : 0,
  }
}
