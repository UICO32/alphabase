import { useMemo } from 'react'
import * as THREE from 'three'
import type { TopicPeak } from './types'

const G_N = 200
const G_EXT = 20.0
const G_STEP = (2 * G_EXT) / G_N

function noise2(x: number, z: number, fx: number, fz: number, ph: number): number {
  return Math.sin(x * fx + ph) * Math.cos(z * fz + ph * 1.3)
}

export function useContourScene(peaks: TopicPeak[]) {
  // Only recompute terrain when spatial data changes (x, z, notes), not labels
  const spatialKey = peaks.map(p => `${p.x.toFixed(3)},${p.z.toFixed(3)},${p.notes}`).join('|')

  return useMemo(() => {
    if (peaks.length === 0) {
      return { contours: [], peakH: 0, yOff: 0, anchorPositions: [], xs: new Float64Array(0), zs: new Float64Array(0) }
    }

    const MAX_N = Math.max(...peaks.map(t => t.notes))

    function H(x: number, z: number): number {
      let h = 0
      for (const t of peaks) {
        const w = t.notes / MAX_N
        const sig = 0.75 + w * 0.95
        const ht = w * 4.2 + 0.55
        const r = Math.sqrt((x - t.x) ** 2 + (z - t.z) ** 2)
        h += ht * Math.exp(-r / sig)
      }
      h += noise2(x, z, 1.6, 2.1, 0.0) * 0.14
      h += noise2(x, z, 3.4, 2.7, 1.2) * 0.07
      h += noise2(x, z, 5.8, 5.0, 2.6) * 0.03
      const r = Math.sqrt(x * x + z * z)
      if (r > 24.0) h *= Math.max(0, 1 - (r - 24.0) / 6.0)
      return Math.max(0, h)
    }

    // Pre-compute coordinate arrays for marching squares
    const XS = new Float64Array(G_N + 1)
    const ZS = new Float64Array(G_N + 1)
    for (let i = 0; i <= G_N; i++) XS[i] = -G_EXT + i * G_STEP
    for (let j = 0; j <= G_N; j++) ZS[j] = -G_EXT + j * G_STEP

    // Find global max height for contour range
    let MAX_H = 0
    for (let j = 0; j <= G_N; j++) {
      for (let i = 0; i <= G_N; i++) {
        const h = H(XS[i], ZS[j])
        if (h > MAX_H) MAX_H = h
      }
    }

    const PEAK_H = MAX_H
    const Y_OFF = -PEAK_H * 0.36

    // Height grid
    const HGRID: Float32Array[] = []
    for (let j = 0; j <= G_N; j++) {
      HGRID[j] = new Float32Array(G_N + 1)
      for (let i = 0; i <= G_N; i++) HGRID[j][i] = H(XS[i], ZS[j])
    }

    // Marching squares
    function msSegments(lv: number): number[][][] {
      const segs: number[][][] = []
      for (let j = 0; j < G_N; j++) {
        for (let i = 0; i < G_N; i++) {
          const h00 = HGRID[j][i], h10 = HGRID[j][i + 1]
          const h11 = HGRID[j + 1][i + 1], h01 = HGRID[j + 1][i]
          const idx = (h00 > lv ? 8 : 0) | (h10 > lv ? 4 : 0) | (h11 > lv ? 2 : 0) | (h01 > lv ? 1 : 0)
          if (idx === 0 || idx === 15) continue

          const x0 = XS[i], x1 = XS[i + 1], z0 = ZS[j], z1 = ZS[j + 1]
          const Lp = (a: number, b: number, va: number, vb: number) => {
            const d = vb - va
            return Math.abs(d) < 1e-9 ? (a + b) * 0.5 : a + (b - a) * (lv - va) / d
          }
          const B = () => [Lp(x0, x1, h00, h10), z0]
          const R = () => [x1, Lp(z0, z1, h10, h11)]
          const T = () => [Lp(x0, x1, h01, h11), z1]
          const Lo = () => [x0, Lp(z0, z1, h00, h01)]
          switch (idx) {
            case 1: segs.push([T(), Lo()]); break
            case 2: segs.push([R(), T()]); break
            case 3: segs.push([R(), Lo()]); break
            case 4: segs.push([B(), R()]); break
            case 5: segs.push([B(), R()]); segs.push([T(), Lo()]); break
            case 6: segs.push([B(), T()]); break
            case 7: segs.push([B(), Lo()]); break
            case 8: segs.push([B(), Lo()]); break
            case 9: segs.push([B(), T()]); break
            case 10: segs.push([B(), Lo()]); segs.push([R(), T()]); break
            case 11: segs.push([B(), R()]); break
            case 12: segs.push([R(), Lo()]); break
            case 13: segs.push([R(), T()]); break
            case 14: segs.push([T(), Lo()]); break
          }
        }
      }
      return segs
    }

    // Chain segments into closed loops
    function chainLoops(segs: number[][][]): number[][][] {
      if (!segs.length) return []
      const S = 1e5
      const qk = (x: number, z: number) => `${Math.round(x * S)},${Math.round(z * S)}`
      const adj = new Map<string, [number, number][]>()
      segs.forEach((s, si) => s.forEach((pt, ei) => {
        const k = qk(pt[0], pt[1])
        if (!adj.has(k)) adj.set(k, [])
        adj.get(k)!.push([si, ei])
      }))
      const vis = new Uint8Array(segs.length)
      const loops: number[][][] = []
      for (let s0 = 0; s0 < segs.length; s0++) {
        if (vis[s0]) continue
        const pts: number[][] = []
        let si = s0, ei = 0
        while (!vis[si]) {
          vis[si] = 1
          pts.push(segs[si][ei])
          const k = qk(segs[si][1 - ei][0], segs[si][1 - ei][1])
          const nbrs = adj.get(k) || []
          let nx = -1, ne = -1
          for (const [nsi, nei] of nbrs) if (!vis[nsi]) { nx = nsi; ne = nei; break }
          if (nx === -1) break
          si = nx; ei = ne
        }
        if (pts.length >= 14) loops.push(pts)
      }
      return loops
    }

    // Build contour levels
    const N = 20
    const MIN = 0.30
    const MAX = PEAK_H - 0.05
    const levels = Array.from({ length: N + 1 }, (_, i) => MIN + (i / N) * (MAX - MIN))

    // Build contour geometry
    const TUBE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 })
    const LINE_MAT = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })

    const contours: Array<{
      line: THREE.Line
      tube: THREE.Mesh | null
      fill: THREE.Mesh | null
    }> = []

    const mountainGroup = new THREE.Group()
    mountainGroup.position.y = Y_OFF

    for (const lv of levels) {
      for (const pts of chainLoops(msSegments(lv))) {
        const vecs = pts.map(([x, z]) => new THREE.Vector3(x, lv, z))
        if (vecs.length < 6) continue

        // Line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([...vecs, vecs[0]])
        lineGeo.setDrawRange(0, 0)
        const line = new THREE.Line(lineGeo, LINE_MAT)
        mountainGroup.add(line)

        // Tube
        let tube: THREE.Mesh | null = null
        if (vecs.length >= 6) {
          const curve = new THREE.CatmullRomCurve3(vecs, true, 'catmullrom', 0.4)
          const tubeGeo = new THREE.TubeGeometry(curve, Math.min(vecs.length * 2, 360), 0.030, 8, true)
          tube = new THREE.Mesh(tubeGeo, TUBE_MAT)
          tube.visible = false
          mountainGroup.add(tube)
        }

        // Fill slice
        let fill: THREE.Mesh | null = null
        if (vecs.length >= 6) {
          const shape = new THREE.Shape()
          shape.moveTo(vecs[0].x, vecs[0].z)
          for (let i = 1; i < vecs.length; i++) shape.lineTo(vecs[i].x, vecs[i].z)
          shape.closePath()
          const fillGeo = new THREE.ShapeGeometry(shape, 1)
          fillGeo.rotateX(Math.PI / 2)
          const fillMat = new THREE.MeshBasicMaterial({
            color: 0x00060e, transparent: true, opacity: 0.58,
            side: THREE.DoubleSide, depthWrite: false,
          })
          fill = new THREE.Mesh(fillGeo, fillMat)
          fill.position.y = lv
          fill.renderOrder = 1
          fill.visible = false
          mountainGroup.add(fill)
        }

        contours.push({ line, tube, fill })
      }
    }

    // Anchor positions for labels (label comes from peaks at render time)
    const anchorPositions = peaks.map(t => ({
      id: t.id,
      notes: t.notes,
      worldPos: new THREE.Vector3(t.x, H(t.x, t.z) + Y_OFF, t.z),
    }))

    return { mountainGroup, contours, peakH: PEAK_H, yOff: Y_OFF, anchorPositions, H, contourLevels: levels }
  }, [spatialKey])
}