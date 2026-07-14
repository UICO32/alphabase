/**
 * Low-poly house geometry for the TopographyView 3D scene.
 *
 * Each card gets a small house model positioned on the terrain.
 * Houses use a solid white fill mesh + a dynamic black silhouette
 * edge mesh that updates based on camera direction.
 *
 * Extracted from TopographyView.tsx as part of R1 component split.
 */

import * as THREE from 'three'
import type { TopicPeak } from './types'

// Deterministic hash from string for reproducible scatter
export function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

export interface HouseData {
  fillMesh: THREE.Mesh
  outlineMesh: THREE.LineSegments
  hitMesh: THREE.Mesh
}

export interface HouseWorldPosition {
  x: number
  y: number
  z: number
  cardId: string
  title: string
}

// Low-poly house: solid white fill + dynamic black silhouette edges
// Silhouette = edges shared by two faces whose normals point to opposite sides of the view
interface HouseTemplate {
  fillPositions: Float32Array
  fillNormals: Float32Array
  fillIndices: number[]
  edgePositions: Float32Array
  edgeIndices: number[]
  // Per-poly data for silhouette detection
  polyFaceIndices: number[][]  // poly → [face0, face1]  (2 triangles per quad)
  polyNormals: THREE.Vector3[] // one normal per quad polygon
  hitPositions: Float32Array
  hitIndices: number[]
}

function buildHouseTemplate(): HouseTemplate {
  const w = 0.18, d = 0.18, h = 0.28, rh = 0.18
  // Vertices
  const v = [
    // 0-3: base
    -w, 0, -d,   w, 0, -d,   w, 0, d,   -w, 0, d,
    // 4-7: top
    -w, h, -d,   w, h, -d,   w, h, d,   -w, h, d,
    // 8:  roof peak
    0, h + rh, 0,
  ]
  const fillPositions = new Float32Array(v)

  // Face normals (outward)
  const nF = [0, 0, -1] // front
  const nB = [0, 0, 1]  // back
  const nR = [1, 0, 0]  // right
  const nL = [-1, 0, 0] // left
  const nU = [0, 1, 0]  // up

  // Triangles (CCW when viewed from outside)
  const fillIndices = [
    // front wall
    0, 1, 4,   1, 5, 4,
    // right wall
    1, 2, 5,   2, 6, 5,
    // back wall
    2, 3, 6,   3, 7, 6,
    // left wall
    3, 0, 7,   0, 4, 7,
    // roof front
    4, 5, 8,
    // roof right
    5, 6, 8,
    // roof back
    6, 7, 8,
    // roof left
    7, 4, 8,
  ]

  // Per-vertex normals for smooth-ish fill
  const faceNormals = [
    nF, nF, nF, nF, nF, nF,
    nR, nR, nR, nR, nR, nR,
    nB, nB, nB, nB, nB, nB,
    nL, nL, nL, nL, nL, nL,
    nU, nU, nU,
    nU, nU, nU,
    nU, nU, nU,
    nU, nU, nU,
  ]
  const fillNormals = new Float32Array(fillIndices.length * 3)
  for (let i = 0; i < fillIndices.length; i++) {
    const n = faceNormals[i]
    fillNormals[i * 3] = n[0]
    fillNormals[i * 3 + 1] = n[1]
    fillNormals[i * 3 + 2] = n[2]
  }

  // Edges (line segments) — all unique edges for silhouette detection
  const edgePositions = fillPositions.slice() // same vertices
  const edgeIndices: number[] = []
  const added = new Set<string>()
  function addEdge(a: number, b: number) {
    const key = Math.min(a, b) + ',' + Math.max(a, b)
    if (added.has(key)) return
    added.add(key)
    edgeIndices.push(a, b)
  }
  // Base edges
  addEdge(0, 1); addEdge(1, 2); addEdge(2, 3); addEdge(3, 0)
  // Top edges
  addEdge(4, 5); addEdge(5, 6); addEdge(6, 7); addEdge(7, 4)
  // Vertical edges
  addEdge(0, 4); addEdge(1, 5); addEdge(2, 6); addEdge(3, 7)
  // Roof edges
  addEdge(4, 8); addEdge(5, 8); addEdge(6, 8); addEdge(7, 8)

  // Per-polygon data for silhouette detection
  // Each quad is 2 triangles; group them into polygon faces
  const polyFaceIndices = [
    [0, 1],    // front
    [2, 3],    // right
    [4, 5],    // back
    [6, 7],    // left
    [8],       // roof front
    [9],       // roof right
    [10],      // roof back
    [11],      // roof left
  ]
  const polyNormals = [
    new THREE.Vector3(...nF),
    new THREE.Vector3(...nR),
    new THREE.Vector3(...nB),
    new THREE.Vector3(...nL),
    new THREE.Vector3(0, 0.5, -0.5).normalize(),  // roof front
    new THREE.Vector3(0.5, 0.5, 0).normalize(),    // roof right
    new THREE.Vector3(0, 0.5, 0.5).normalize(),    // roof back
    new THREE.Vector3(-0.5, 0.5, 0).normalize(),   // roof left
  ]

  // Hit box (slightly larger than house)
  const hw = w + 0.08, hd = d + 0.08, hh = h + rh + 0.04
  const hitPositions = new Float32Array([
    -hw, 0, -hd,   hw, 0, -hd,   hw, 0, hd,   -hw, 0, hd,
    -hw, hh, -hd,  hw, hh, -hd,  hw, hh, hd,  -hw, hh, hd,
  ])
  const hitIndices = [
    0, 1, 4,   1, 5, 4,
    1, 2, 5,   2, 6, 5,
    2, 3, 6,   3, 7, 6,
    3, 0, 7,   0, 4, 7,
    4, 5, 6,   4, 6, 7,
    0, 2, 1,   0, 3, 2,
  ]

  return { fillPositions, fillNormals, fillIndices, edgePositions, edgeIndices, polyFaceIndices, polyNormals, hitPositions, hitIndices }
}

function buildPolyNormals(faceNormals: THREE.Vector3[], polyFaceIndices: number[][]): THREE.Vector3[] {
  return polyFaceIndices.map(faceIdx => {
    const n = new THREE.Vector3()
    for (const fi of faceIdx) n.add(faceNormals[fi])
    n.normalize()
    return n
  })
}

export function buildHouses(
  peaks: TopicPeak[],
  cardTitles: Record<string, string>,
  H: (x: number, z: number) => number,
  yOff: number,
  contourLevels: number[],
): { houses: HouseData[]; houseWorldPositions: HouseWorldPosition[] } {
  const tpl = buildHouseTemplate()
  const houses: HouseData[] = []
  const houseWorldPositions: HouseWorldPosition[] = []

  // Pre-compute per-template face normals for silhouette
  const templateFaceNormals: THREE.Vector3[] = []
  for (let i = 0; i < tpl.fillIndices.length; i += 3) {
    const a = new THREE.Vector3().fromArray(tpl.fillPositions, tpl.fillIndices[i] * 3)
    const b = new THREE.Vector3().fromArray(tpl.fillPositions, tpl.fillIndices[i + 1] * 3)
    const c = new THREE.Vector3().fromArray(tpl.fillPositions, tpl.fillIndices[i + 2] * 3)
    const ab = new THREE.Vector3().subVectors(b, a)
    const ac = new THREE.Vector3().subVectors(c, a)
    templateFaceNormals.push(new THREE.Vector3().crossVectors(ab, ac).normalize())
  }
  const templatePolyNormals = buildPolyNormals(templateFaceNormals, tpl.polyFaceIndices)

  for (const peak of peaks) {
    for (const cardId of peak.cardIds) {
      const scatter = hashStr(cardId)
      const sx = ((scatter & 0xff) / 255 - 0.5) * 1.2
      const sz = (((scatter >> 8) & 0xff) / 255 - 0.5) * 1.2
      const x = peak.x + sx
      const z = peak.z + sz
      const terrainH = Math.max(0, H(x, z))
      let snappedH = terrainH
      // Snap to nearest contour level so the house sits on a contour line
      if (contourLevels.length > 0) {
        let best = contourLevels[0]
        let bestDist = Math.abs(terrainH - best)
        for (let i = 1; i < contourLevels.length; i++) {
          const dist = Math.abs(terrainH - contourLevels[i])
          if (dist < bestDist) { bestDist = dist; best = contourLevels[i] }
        }
        snappedH = best
      }
      const y = snappedH + yOff

      // Fill mesh
      const fillGeo = new THREE.BufferGeometry()
      fillGeo.setAttribute('position', new THREE.BufferAttribute(tpl.fillPositions.slice(), 3))
      fillGeo.setAttribute('normal', new THREE.BufferAttribute(tpl.fillNormals.slice(), 3))
      fillGeo.setIndex(tpl.fillIndices.slice())
      const fillMesh = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
      }))

      // Edge mesh (silhouette)
      const edgeGeo = new THREE.BufferGeometry()
      edgeGeo.setAttribute('position', new THREE.BufferAttribute(tpl.edgePositions.slice(), 3))
      edgeGeo.setIndex(tpl.edgeIndices.slice())
      const outlineMesh = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.3,
      }))

      // Hit mesh (invisible, larger)
      const hitGeo = new THREE.BufferGeometry()
      hitGeo.setAttribute('position', new THREE.BufferAttribute(tpl.hitPositions.slice(), 3))
      hitGeo.setIndex(tpl.hitIndices.slice())
      const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({
        visible: false,
      }))

      const group = new THREE.Group()
      group.position.set(x, y, z)
      group.add(fillMesh)
      group.add(outlineMesh)
      group.add(hitMesh)

      // Store template normal references for silhouette updates
      const houseData: HouseData & {
        _tplPolyNormals: THREE.Vector3[]
        _tplEdgeIndices: number[]
        _tplPolyFaceIndices: number[][]
      } = {
        fillMesh, outlineMesh, hitMesh,
        _tplPolyNormals: templatePolyNormals,
        _tplEdgeIndices: tpl.edgeIndices,
        _tplPolyFaceIndices: tpl.polyFaceIndices,
      }
      houses.push(houseData as HouseData)
      houseWorldPositions.push({ x, y, z, cardId, title: cardTitles[cardId] || '未命名' })
    }
  }

  return { houses, houseWorldPositions }
}

export function updateSilhouette(house: HouseData, camDir: THREE.Vector3) {
  const h = house as HouseData & {
    _tplPolyNormals: THREE.Vector3[]
    _tplEdgeIndices: number[]
    _tplPolyFaceIndices: number[][]
  }
  if (!h._tplPolyNormals) return

  // Determine which polygons face toward the camera
  const facingToward = h._tplPolyNormals.map(n => n.dot(camDir) > 0)

  // An edge is a silhouette edge if exactly one adjacent polygon faces toward
  // Build edge → polygon adjacency from polyFaceIndices
  const edgePolyMap = new Map<string, number[]>()
  for (let pi = 0; pi < h._tplPolyFaceIndices.length; pi++) {
    for (const fi of h._tplPolyFaceIndices[pi]) {
      const a = h._tplEdgeIndices[fi * 2]
      const b = h._tplEdgeIndices[fi * 2 + 1]
      const key = Math.min(a, b) + ',' + Math.max(a, b)
      if (!edgePolyMap.has(key)) edgePolyMap.set(key, [])
      edgePolyMap.get(key)!.push(pi)
    }
  }

  const visibleEdgeIndices: number[] = []
  for (let ei = 0; ei < h._tplEdgeIndices.length; ei += 2) {
    const a = h._tplEdgeIndices[ei]
    const b = h._tplEdgeIndices[ei + 1]
    const key = Math.min(a, b) + ',' + Math.max(a, b)
    const polys = edgePolyMap.get(key) || []
    const isSilhouette = polys.length === 1 || (polys.length === 2 && facingToward[polys[0]] !== facingToward[polys[1]])
    if (isSilhouette) {
      visibleEdgeIndices.push(a, b)
    }
  }

  // Rebuild edge geometry with only silhouette edges
  const newIdx = new Uint16Array(visibleEdgeIndices)
  house.outlineMesh.geometry.setIndex(new THREE.BufferAttribute(newIdx, 1))
  house.outlineMesh.geometry.index!.needsUpdate = true
}
