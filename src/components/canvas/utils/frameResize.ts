/**
 * Pure resize computation for FrameNode.
 *
 * Extracted from FrameNode.tsx as part of R2 component split.
 * All functions are pure and easily testable.
 */

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const MIN_WIDTH = 300
const MIN_HEIGHT = 200

/**
 * Compute the new frame dimensions given a resize direction,
 * mouse delta (in canvas coordinates, already zoom-adjusted),
 * and the starting dimensions.
 */
export function computeResize(
  dir: ResizeDir,
  dx: number,
  dy: number,
  startW: number,
  startH: number,
): { width: number; height: number } {
  let newW = startW
  let newH = startH
  if (dir.includes('e')) newW = Math.max(MIN_WIDTH, startW + dx)
  if (dir.includes('s')) newH = Math.max(MIN_HEIGHT, startH + dy)
  if (dir.includes('w')) newW = Math.max(MIN_WIDTH, startW - dx)
  if (dir.includes('n')) newH = Math.max(MIN_HEIGHT, startH - dy)
  return { width: newW, height: newH }
}
