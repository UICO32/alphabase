import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useContourScene } from './useContourScene'
import { useClusterData } from './useClusterData'
import { useCardStore } from '../../stores/cardStore'
import { useLibraryStore } from '../../stores/libraryStore'
import type { TopicPeak } from './types'

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

// Deterministic hash from string for reproducible scatter
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

// Low-poly house: solid white fill + dynamic black silhouette edges
// Silhouette = edges shared by two faces whose normals point to opposite sides of the view
interface HouseData {
  fillMesh: THREE.Mesh
  outlineMesh: THREE.LineSegments
  hitMesh: THREE.Mesh
  // Precomputed face normals (unit) in local space
  faceNormals: THREE.Vector3[]
  // Edge-face adjacency: each edge knows which two faces share it
  // edgeFaces[i] = [faceA, faceB] or [faceA, -1] for boundary edges
  edgeFaces: number[][]
  // All edge vertex positions (pairs) in local space
  edgeVerts: Float32Array
}

function buildHouseTemplate(): {
  fillGeo: Float32Array
  faceNormals: THREE.Vector3[]
  edgeVerts: Float32Array
  edgeFaces: number[][]
} {
  const bw = 0.09, bh = 0.08, bd = 0.07
  const hw = bw / 2, hd = bd / 2
  const by = 0
  const rh = 0.07, ry = by + bh
  const rw = hw, rd = hd

  // Vertices
  const V = {
    bfl: [-hw, by, -hd], bfr: [hw, by, -hd], bbr: [hw, by, hd], bbl: [-hw, by, hd],
    tfl: [-hw, by + bh, -hd], tfr: [hw, by + bh, -hd], tbr: [hw, by + bh, hd], tbl: [-hw, by + bh, hd],
    rfl: [-rw, ry, -rd], rfr: [rw, ry, -rd], rbr: [rw, ry, rd], rbl: [-rw, ry, rd],
    pk: [0, ry + rh, 0],
  }

  // Faces (triangles) — each face = [v0, v1, v2]
  const faces: number[][] = [
    // Box: front (-z)
    [...V.bfl, ...V.bfr, ...V.tfr], [...V.bfl, ...V.tfr, ...V.tfl],
    // Box: back (+z)
    [...V.bbr, ...V.bbl, ...V.tbl], [...V.bbr, ...V.tbl, ...V.tbr],
    // Box: right (+x)
    [...V.bfr, ...V.bbr, ...V.tbr], [...V.bfr, ...V.tbr, ...V.tfr],
    // Box: left (-x)
    [...V.bbl, ...V.bfl, ...V.tfl], [...V.bbl, ...V.tfl, ...V.tbl],
    // Box: top
    [...V.tfl, ...V.tfr, ...V.tbr], [...V.tfl, ...V.tbr, ...V.tbl],
    // Box: bottom
    [...V.bbl, ...V.bbr, ...V.bfr], [...V.bbl, ...V.bfr, ...V.bfl],
    // Roof: front
    [...V.rfl, ...V.rfr, ...V.pk],
    // Roof: back
    [...V.rbr, ...V.rbl, ...V.pk],
    // Roof: right
    [...V.rfr, ...V.rbr, ...V.pk],
    // Roof: left
    [...V.rbl, ...V.rfl, ...V.pk],
  ]

  // Compute face normals
  const faceNormals: THREE.Vector3[] = []
  for (const f of faces) {
    const a = new THREE.Vector3(f[0], f[1], f[2])
    const b = new THREE.Vector3(f[3], f[4], f[5])
    const c = new THREE.Vector3(f[6], f[7], f[8])
    const n = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(b, a),
      new THREE.Vector3().subVectors(c, a),
    ).normalize()
    faceNormals.push(n)
  }

  // Fill geometry
  const fillVerts: number[] = []
  for (const f of faces) fillVerts.push(...f)

  // All unique edges (as vertex pairs) and their face adjacency
  // Key = sorted vertex key for dedup
  const vk = (v: number[]) => v.map(c => Math.round(c * 1e5)).join(',')
  const edgeMap = new Map<string, { v0: number[]; v1: number[]; faces: number[] }>()

  // Each face (pair of triangles) shares edges — we define faces as quads for box + tris for roof
  const quads: number[][][] = [
    // Box faces as quads [v0,v1,v2,v3]
    [V.bfl, V.bfr, V.tfr, V.tfl], // front
    [V.bbr, V.bbl, V.tbl, V.tbr], // back
    [V.bfr, V.bbr, V.tbr, V.tfr], // right
    [V.bbl, V.bfl, V.tfl, V.tbl], // left
    [V.tfl, V.tfr, V.tbr, V.tbl], // top
    [V.bbl, V.bbr, V.bfr, V.bfl], // bottom
  ]
  // Roof faces as triangles [v0,v1,v2]
  const roofTris: number[][][] = [
    [V.rfl, V.rfr, V.pk], // front
    [V.rbr, V.rbl, V.pk], // back
    [V.rfr, V.rbr, V.pk], // right
    [V.rbl, V.rfl, V.pk], // left
  ]

  // Map quad/poly face index → list of triangle face indices in `faces` array
  // Box quads: each quad = 2 triangles → face indices 0-1, 2-3, 4-5, 6-7, 8-9, 10-11
  // Roof tris: each tri = 1 triangle → face indices 12, 13, 14, 15
  function addEdge(v0: number[], v1: number[], polyIdx: number) {
    const k0 = vk(v0), k1 = vk(v1)
    const key = k0 < k1 ? k0 + '|' + k1 : k1 + '|' + k0
    let entry = edgeMap.get(key)
    if (!entry) {
      entry = { v0: k0 < k1 ? v0 : v1, v1: k0 < k1 ? v1 : v0, faces: [] }
      edgeMap.set(key, entry)
    }
    if (!entry.faces.includes(polyIdx)) entry.faces.push(polyIdx)
  }

  // Add edges from quads
  for (let qi = 0; qi < quads.length; qi++) {
    const q = quads[qi]
    for (let j = 0; j < q.length; j++) {
      addEdge(q[j], q[(j + 1) % q.length], qi)
    }
  }
  // Add edges from roof triangles
  for (let ti = 0; ti < roofTris.length; ti++) {
    const t = roofTris[ti]
    const polyIdx = quads.length + ti
    for (let j = 0; j < t.length; j++) {
      addEdge(t[j], t[(j + 1) % t.length], polyIdx)
    }
  }

  // Build edge vertex buffer and adjacency
  const edges = [...edgeMap.values()]
  const edgeVerts = new Float32Array(edges.length * 6)
  const edgeFaces: number[][] = []
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    edgeVerts[i * 6] = e.v0[0]; edgeVerts[i * 6 + 1] = e.v0[1]; edgeVerts[i * 6 + 2] = e.v0[2]
    edgeVerts[i * 6 + 3] = e.v1[0]; edgeVerts[i * 6 + 4] = e.v1[1]; edgeVerts[i * 6 + 5] = e.v1[2]
    edgeFaces.push(e.faces)
  }

  return {
    fillGeo: new Float32Array(fillVerts),
    faceNormals,
    edgeVerts,
    edgeFaces,
  }
}

// Precompute poly-face average normals (for silhouette detection)
// Each poly-face has an average normal from its constituent triangles
function buildPolyNormals(faceNormals: THREE.Vector3[], polyFaceIndices: number[][]): THREE.Vector3[] {
  return polyFaceIndices.map(indices => {
    const avg = new THREE.Vector3()
    for (const idx of indices) avg.add(faceNormals[idx])
    return avg.normalize()
  })
}

const POLY_FACE_INDICES: number[][] = [
  [0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11],
  [12], [13], [14], [15],
]

function buildHouses(
  peaks: TopicPeak[],
  cardTitles: Record<string, string>,
  H: (x: number, z: number) => number,
  yOff: number,
  contourLevels: number[],
): { houses: HouseData[]; houseWorldPositions: Array<{ x: number; y: number; z: number; cardId: string; title: string }> } {
  const template = buildHouseTemplate()
  const polyNormals = buildPolyNormals(template.faceNormals, POLY_FACE_INDICES)
  const houses: HouseData[] = []
  const houseWorldPositions: Array<{ x: number; y: number; z: number; cardId: string; title: string }> = []

  for (const peak of peaks) {
    const n = peak.cardIds.length
    for (let i = 0; i < n; i++) {
      const cardId = peak.cardIds[i]
      const h = hashStr(cardId)

      const angle = ((h & 0xffff) / 0xffff) * Math.PI * 2
      const radius = 0.3 + ((h >>> 16 & 0xff) / 0xff) * 1.2
      const x = peak.x + Math.cos(angle) * radius
      const z = peak.z + Math.sin(angle) * radius

      // Snap house height to nearest contour level so it sits ON a slice
      const terrainH = Math.max(0, H(x, z))
      let snappedH = terrainH
      if (contourLevels.length > 0) {
        let best = contourLevels[0]
        let bestDiff = Math.abs(contourLevels[0] - terrainH)
        for (let li = 1; li < contourLevels.length; li++) {
          const diff = Math.abs(contourLevels[li] - terrainH)
          if (diff < bestDiff) { bestDiff = diff; best = contourLevels[li] }
        }
        snappedH = best
      }
      const y = snappedH + yOff
      const scale = 0.8 + Math.min(n / 10, 0.6)

      // White fill mesh
      const fGeo = new THREE.BufferGeometry()
      fGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(template.fillGeo), 3))
      const fillMesh = new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, side: THREE.DoubleSide, depthWrite: true,
      }))
      fillMesh.position.set(x, y, z)
      fillMesh.scale.setScalar(scale)

      // Invisible hit box — 2x larger for easier hover/click
      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.30, 0.26),
        new THREE.MeshBasicMaterial({ visible: false }),
      )
      hitMesh.position.set(x, y + 0.07 * scale, z)
      hitMesh.scale.setScalar(scale)
      hitMesh.userData.fillIndex = -1 // set later

      // Outline LineSegments — buffer sized for all edges, updated each frame
      const maxSegs = template.edgeFaces.length
      const oGeo = new THREE.BufferGeometry()
      const posAttr = new THREE.BufferAttribute(new Float32Array(maxSegs * 6), 3)
      posAttr.setUsage(THREE.DynamicDrawUsage)
      oGeo.setAttribute('position', posAttr)
      oGeo.setDrawRange(0, 0)
      const outlineMesh = new THREE.LineSegments(oGeo, new THREE.LineBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.55,
      }))
      outlineMesh.position.set(x, y, z)
      outlineMesh.scale.setScalar(scale)

      houses.push({
        fillMesh,
        outlineMesh,
        hitMesh,
        faceNormals: polyNormals,
        edgeFaces: template.edgeFaces,
        edgeVerts: template.edgeVerts,
      })

      houseWorldPositions.push({
        x, y: y + (0.08 + 0.07) * scale, z,
        cardId,
        title: cardTitles[cardId] || '未命名',
      })
    }
  }

  return { houses, houseWorldPositions }
}

// Update silhouette edges for a single house based on camera direction
function updateSilhouette(house: HouseData, camDir: THREE.Vector3) {
  const { edgeFaces, edgeVerts } = house
  const posAttr = house.outlineMesh.geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = posAttr.array as Float32Array

  // Compute which poly-faces are front-facing
  const isFront = new Uint8Array(house.faceNormals.length)
  for (let i = 0; i < house.faceNormals.length; i++) {
    isFront[i] = house.faceNormals[i].dot(camDir) > 0 ? 1 : 0
  }

  let segCount = 0
  const edgeCount = edgeFaces.length
  for (let ei = 0; ei < edgeCount; ei++) {
    const faces = edgeFaces[ei]
    // Silhouette if adjacent faces have different facing
    let isSilhouette = false
    if (faces.length === 2) {
      isSilhouette = isFront[faces[0]] !== isFront[faces[1]]
    } else if (faces.length === 1) {
      // Boundary edge — always draw
      isSilhouette = true
    }
    if (isSilhouette) {
      const srcOff = ei * 6
      const dstOff = segCount * 6
      arr[dstOff] = edgeVerts[srcOff]
      arr[dstOff + 1] = edgeVerts[srcOff + 1]
      arr[dstOff + 2] = edgeVerts[srcOff + 2]
      arr[dstOff + 3] = edgeVerts[srcOff + 3]
      arr[dstOff + 4] = edgeVerts[srcOff + 4]
      arr[dstOff + 5] = edgeVerts[srcOff + 5]
      segCount++
    }
  }

  posAttr.needsUpdate = true
  house.outlineMesh.geometry.setDrawRange(0, segCount * 2)
}

export function TopographyView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const animIdRef = useRef<number>(0)
  const labelElsRef = useRef<HTMLDivElement[]>([])
  const tooltipElRef = useRef<HTMLDivElement | null>(null)
  const peaksRef = useRef<TopicPeak[]>([])

  const { peaks, loading, error } = useClusterData()
  peaksRef.current = peaks
  const sceneData = useContourScene(peaks)

  // Update label DOM text when peaks labels change (LLM naming), without rebuilding the scene
  useEffect(() => {
    const labels = labelElsRef.current
    for (let i = 0; i < labels.length; i++) {
      const anchor = sceneData.anchorPositions[i]
      if (!anchor) continue
      const peak = peaks.find(p => p.id === anchor.id)
      const labelDiv = labels[i].firstChild as HTMLDivElement | null
      if (labelDiv && peak) labelDiv.textContent = peak.label
    }
  }, [peaks, sceneData.anchorPositions])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !sceneData.mountainGroup) return

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const C = isDark ? DARK_COLORS : LIGHT_COLORS

    // Build card title map from store snapshot (stable reference within this effect)
    const cardTitles: Record<string, string> = {}
    for (const [id, card] of Object.entries(useCardStore.getState().cards)) {
      cardTitles[id] = card.title || '未命名'
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(C.bg)
    scene.fog = new THREE.FogExp2(C.fog, C.fogDensity)

    const camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 300)
    camera.position.set(0, 16, 28)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.5, 0)
    controls.enablePan = false
    controls.enableZoom = true
    controls.minDistance = 5
    controls.maxDistance = 50
    controls.minPolarAngle = 0.08
    controls.maxPolarAngle = Math.PI * 0.50
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.update()

    scene.add(new THREE.AmbientLight(C.ambientColor, C.ambientIntensity))
    const kL = new THREE.PointLight(isDark ? 0xffffff : 0xfff8e1, 3, 100)
    kL.position.set(2, 16, 5)
    scene.add(kL)

    // Override contour materials for light mode
    if (!isDark) {
      sceneData.mountainGroup.traverse(obj => {
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material as THREE.Material
          if (mat.type === 'MeshBasicMaterial') {
            const mb = mat as THREE.MeshBasicMaterial
            if (mb.color.getHex() === 0xffffff) mb.color.set(C.contourLine)
            if (mb.color.getHex() === 0x00060e) mb.color.set(C.contourFill)
          }
          if (mat.type === 'LineBasicMaterial') {
            const lb = mat as THREE.LineBasicMaterial
            if (lb.color.getHex() === 0xffffff) lb.color.set(C.contourLine)
          }
        }
      })
    }

    scene.add(sceneData.mountainGroup)

    // Low-poly wireframe houses — initially hidden, appear after terrain reveal
    const { houses, houseWorldPositions } = buildHouses(peaksRef.current, cardTitles, sceneData.H, sceneData.yOff, sceneData.contourLevels)
    const houseGroup = new THREE.Group()
    houseGroup.visible = false
    for (const house of houses) {
      houseGroup.add(house.fillMesh)
      houseGroup.add(house.outlineMesh)
      houseGroup.add(house.hitMesh)
    }
    scene.add(houseGroup)

    // --- Clouds (simple flat discs) ---
    const cloudGroup = new THREE.Group()
    for (let i = 0; i < 8; i++) {
      const cx = (Math.random() - 0.5) * 30
      const cz = (Math.random() - 0.5) * 30
      const cy = sceneData.peakH + 3 + Math.random() * 4
      const cloudGeo = new THREE.CircleGeometry(0.8 + Math.random() * 1.2, 8)
      const cloudMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
      })
      const cloud = new THREE.Mesh(cloudGeo, cloudMat)
      cloud.position.set(cx, cy, cz)
      cloud.rotation.x = -Math.PI / 2
      cloudGroup.add(cloud)
    }
    scene.add(cloudGroup)

    // --- Birds (simple V-shaped lines) ---
    const birdGroup = new THREE.Group()
    for (let i = 0; i < 12; i++) {
      const bx = (Math.random() - 0.5) * 40
      const bz = (Math.random() - 0.5) * 40
      const by = sceneData.peakH + 5 + Math.random() * 6
      const birdGeo = new THREE.BufferGeometry()
      const wingSpan = 0.3 + Math.random() * 0.3
      const birdVerts = new Float32Array([
        -wingSpan, 0, 0,
        0, 0.05, 0,
        wingSpan, 0, 0,
      ])
      birdGeo.setAttribute('position', new THREE.BufferAttribute(birdVerts, 3))
      const bird = new THREE.Line(birdGeo, new THREE.LineBasicMaterial({
        color: 0xaaaaaa, transparent: true, opacity: 0.4,
      }))
      bird.position.set(bx, by, bz)
      bird.userData = { speed: 0.01 + Math.random() * 0.02, angle: Math.random() * Math.PI * 2 }
      birdGroup.add(bird)
    }
    scene.add(birdGroup)

    // --- Boats (simple flat triangle on water-level ring) ---
    const boatGroup = new THREE.Group()
    const boatPositions: Array<{ x: number; z: number; angle: number; speed: number }> = []
    for (let i = 0; i < 4; i++) {
      const boatGeo = new THREE.BufferGeometry()
      const bw = 0.25, bl = 0.6
      const boatVerts = new Float32Array([
        0, 0, bl / 2,
        -bw / 2, 0, -bl / 2,
        bw / 2, 0, -bl / 2,
      ])
      boatGeo.setAttribute('position', new THREE.BufferAttribute(boatVerts, 3))
      const boat = new THREE.Mesh(boatGeo, new THREE.MeshBasicMaterial({
        color: 0x888888, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
      }))
      const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5
      const dist = 8 + Math.random() * 4
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      boat.position.set(x, sceneData.yOff - 0.05, z)
      boat.rotation.y = -angle + Math.PI / 2
      boatGroup.add(boat)
      boatPositions.push({ x, z, angle, speed: 0.002 + Math.random() * 0.003 })
    }
    scene.add(boatGroup)

    // Stars
    const starN = 2800
    const starPos = new Float32Array(starN * 3)
    for (let i = 0; i < starN * 3; i++) starPos[i] = (Math.random() - 0.5) * 280
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: C.starColor, size: 0.14, transparent: true, opacity: 0.5
    })))

    // Compass ring
    const COMP_Y = sceneData.yOff - 0.09
    const COMP_R = 9.4
    const cg = new THREE.Group()
    cg.position.y = COMP_Y
    scene.add(cg)

    const rg = new THREE.RingGeometry(COMP_R - 0.08, COMP_R + 0.09, 128)
    rg.rotateX(-Math.PI / 2)
    cg.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
      color: C.compassColor, transparent: true, opacity: 0.20, side: THREE.DoubleSide
    })))

    const dr = new THREE.RingGeometry(COMP_R * 0.87, COMP_R * 0.89, 96)
    dr.rotateX(-Math.PI / 2)
    cg.add(new THREE.Mesh(dr, new THREE.MeshBasicMaterial({
      color: C.compassColor, transparent: true, opacity: 0.09, side: THREE.DoubleSide
    })))

    const tp: number[] = []
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const isC = i % 18 === 0, isM = i % 6 === 0
      const r0 = COMP_R + 0.09, r1 = isC ? r0 + 0.65 : isM ? r0 + 0.38 : r0 + 0.20
      tp.push(r0 * Math.cos(a), 0, r0 * Math.sin(a), r1 * Math.cos(a), 0, r1 * Math.sin(a))
    }
    const tg = new THREE.BufferGeometry()
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tp), 3))
    cg.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({
      color: C.compassColor, transparent: true, opacity: 0.32
    })))

    // Cluster labels (no drop lines, no click)
    labelElsRef.current.forEach(el => el.remove())
    labelElsRef.current = []

    for (const a of sceneData.anchorPositions) {
      const peak = peaksRef.current.find(p => p.id === a.id)
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;pointer-events:auto;cursor:default;z-index:20;' +
        'display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);' +
        'font-family:Courier New,monospace;opacity:0;transition:opacity .5s;'

      const labelDiv = document.createElement('div')
      labelDiv.style.cssText = `background:${C.labelBg};border:1px solid ${C.labelBg};` +
        `white-space:nowrap;font-size:10px;letter-spacing:2px;` +
        `color:${C.labelColor};padding:2px 6px;border-radius:3px;` +
        `max-width:120px;overflow:hidden;transition:max-width .25s ease,padding .25s ease;`
      labelDiv.textContent = peak?.label || ''

      el.appendChild(labelDiv)

      el.addEventListener('mouseenter', () => {
        labelDiv.style.maxWidth = '240px'
        labelDiv.style.padding = '3px 8px'
      })
      el.addEventListener('mouseleave', () => {
        labelDiv.style.maxWidth = '120px'
        labelDiv.style.padding = '2px 6px'
      })

      container.appendChild(el)
      labelElsRef.current.push(el)
    }

    // House tooltip (DOM overlay)
    let tooltipEl = tooltipElRef.current
    if (!tooltipEl) {
      tooltipEl = document.createElement('div')
      tooltipEl.style.cssText = 'position:absolute;z-index:30;pointer-events:none;' +
        'background:rgba(0,0,0,.72);color:rgba(255,255,255,.9);font-size:10px;' +
        'padding:3px 8px;border-radius:4px;white-space:nowrap;font-family:Courier New,monospace;' +
        'opacity:0;transition:opacity .15s;transform:translate(-50%,-100%);'
      container.appendChild(tooltipEl)
      tooltipElRef.current = tooltipEl
    }

    // Raycaster for house hover (target fill meshes, not outlines)
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let hoveredIdx = -1
    let selectedHouseIdx = -1
    let hoverPauseTimer: ReturnType<typeof setTimeout> | null = null
    let isHoverPaused = false

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    container.addEventListener('mousemove', onMouseMove)

    // Click: open card editor + zoom camera
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const clickMouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(clickMouse, camera)
      const clickHitMeshes = houses.map(h => h.hitMesh)
      const intersects = raycaster.intersectObjects(clickHitMeshes, false)
      if (intersects.length > 0) {
        const hitIdx = clickHitMeshes.indexOf(intersects[0].object as THREE.Mesh)
        const hd = houseWorldPositions[hitIdx]
        if (!hd) return

        // Open card in right panel
        useLibraryStore.getState().setEditingCardId(hd.cardId)
        useLibraryStore.getState().setRightPanelActiveTab('editor')
        useLibraryStore.getState().setRightPanelCollapsed(false)

        // Zoom camera to house — from outside looking inward
        const dir = new THREE.Vector3(hd.x, 0, hd.z).normalize()
        const targetPos = new THREE.Vector3(
          hd.x + dir.x * 8,
          hd.y + 5,
          hd.z + dir.z * 8,
        )
        const startPos = camera.position.clone()
        const startTarget = controls.target.clone()
        const endTarget = new THREE.Vector3(hd.x, hd.y, hd.z)
        const zoomDuration = 1200
        const zoomStart = performance.now()
        function animateZoom() {
          const now = performance.now()
          const p = Math.min((now - zoomStart) / zoomDuration, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          camera.position.lerpVectors(startPos, targetPos, ease)
          controls.target.lerpVectors(startTarget, endTarget, ease)
          controls.update()
          if (p < 1) requestAnimationFrame(animateZoom)
        }
        animateZoom()

        // Bold outline for selected house
        selectedHouseIdx = hitIdx
        for (let i = 0; i < houses.length; i++) {
          const mat = houses[i].outlineMesh.material as THREE.LineBasicMaterial
          mat.color.set(i === hitIdx ? 0x2266dd : 0x000000)
          mat.opacity = i === hitIdx ? 1.0 : 0.3
        }

        // Dim nearby mountain fills to reduce occlusion
        if (hd) {
          for (const c of sceneData.contours) {
            if (!c.fill) continue
            const fillPos = c.fill.position
            const dist = Math.sqrt((fillPos.x - hd.x) ** 2 + (fillPos.z - hd.z) ** 2)
            const mat = c.fill.material as THREE.MeshBasicMaterial
            if (dist < 3.0) {
              mat.opacity = 0.12
            } else {
              mat.opacity = 0.58
            }
          }
        }
      }
    }
    container.addEventListener('click', onClick)

    // Entry animation: line-draw → solidify
    const ENTRY_START = 500, DRAW_MS = 320, STAGGER_MS = 50, SOLID_LAG = 130
    const contourAnim = sceneData.contours.map((c, i) => ({
      ...c,
      ptCount: c.line.geometry.attributes.position.count,
      lineStart: ENTRY_START + i * STAGGER_MS,
      lineEnd: ENTRY_START + i * STAGGER_MS + DRAW_MS,
      solidifyAt: ENTRY_START + i * STAGGER_MS + DRAW_MS + SOLID_LAG,
      drawn: false,
      solidified: false,
    }))
    const ENTRY_TOTAL = contourAnim.length > 0
      ? contourAnim[contourAnim.length - 1].solidifyAt + 400
      : 2000

    const t0 = performance.now()
    let entryDone = false, anchorsShown = false

    const _v = new THREE.Vector3()
    const cw = () => container.clientWidth
    const ch = () => container.clientHeight

    function animate() {
      const elapsed = performance.now() - t0
      controls.update()

      // Entry: line-draw → solidify
      if (!entryDone) {
        for (const c of contourAnim) {
          if (elapsed >= c.lineStart && !c.drawn) {
            const p = Math.min((elapsed - c.lineStart) / DRAW_MS, 1)
            c.line.geometry.setDrawRange(0, Math.floor(p * c.ptCount))
            if (p >= 1) c.drawn = true
          }
          if (c.drawn && !c.solidified && elapsed >= c.solidifyAt) {
            c.line.visible = false
            if (c.tube) c.tube.visible = true
            if (c.fill) c.fill.visible = true
            c.solidified = true
          }
        }
        if (!anchorsShown && elapsed > ENTRY_TOTAL - 350) {
          for (const el of labelElsRef.current) el.style.opacity = '1'
          anchorsShown = true
        }
        if (elapsed >= ENTRY_TOTAL) {
          entryDone = true
          houseGroup.visible = true
        }
      }

      // Position cluster labels
      for (let i = 0; i < sceneData.anchorPositions.length; i++) {
        const a = sceneData.anchorPositions[i]
        const el = labelElsRef.current[i]
        if (!el) continue
        _v.copy(a.worldPos).project(camera)
        if (_v.z > 1) { el.style.opacity = '0'; continue }
        if (entryDone || elapsed > 600) el.style.opacity = '1'
        const lx = (_v.x * 0.5 + 0.5) * cw()
        const rawLy = (-_v.y * 0.5 + 0.5) * ch()
        // Clamp: label uses translate(-50%,-100%) so it renders ABOVE rawLy;
        // ensure the bottom of the label (at rawLy) is within the container
        const ly = Math.max(20, Math.min(rawLy, ch() - 4))
        el.style.left = lx + 'px'
        el.style.top = ly + 'px'
      }

      // Update silhouette edges based on camera direction
      const camDir = new THREE.Vector3()
      camera.getWorldDirection(camDir)
      camDir.negate() // we want direction FROM camera TO object
      for (const house of houses) {
        updateSilhouette(house, camDir)
      }

      // House hover raycast (use larger hit boxes for easier targeting)
      raycaster.setFromCamera(mouse, camera)
      const hitMeshes = houses.map(h => h.hitMesh)
      const intersects = raycaster.intersectObjects(hitMeshes, false)

      if (intersects.length > 0) {
        const hitIdx = hitMeshes.indexOf(intersects[0].object as THREE.Mesh)
        if (hitIdx !== hoveredIdx) {
          hoveredIdx = hitIdx
        }
        // Pause rotation on hover
        if (!isHoverPaused) {
          isHoverPaused = true
          controls.autoRotate = false
          if (hoverPauseTimer) { clearTimeout(hoverPauseTimer); hoverPauseTimer = null }
        }
        if (hoveredIdx >= 0 && hoveredIdx < houseWorldPositions.length) {
          const hd = houseWorldPositions[hoveredIdx]
          _v.set(hd.x, hd.y, hd.z).project(camera)
          tooltipEl!.style.opacity = '1'
          const tx = (_v.x * 0.5 + 0.5) * cw()
          const ty = Math.max(16, (-_v.y * 0.5 + 0.5) * ch())
          tooltipEl!.style.left = tx + 'px'
          tooltipEl!.style.top = ty + 'px'
          tooltipEl!.textContent = hd.title
        }
      } else {
        if (hoveredIdx !== -1) {
          // Mouse left a house — schedule resume after 1.5s
          if (hoverPauseTimer) clearTimeout(hoverPauseTimer)
          hoverPauseTimer = setTimeout(() => {
            isHoverPaused = false
            controls.autoRotate = true
          }, 1500)
        }
        hoveredIdx = -1
        tooltipEl!.style.opacity = '0'
      }

      // Update house fill colors: hover = light blue, selected = blue, default = white
      for (let i = 0; i < houses.length; i++) {
        const mat = houses[i].fillMesh.material as THREE.MeshBasicMaterial
        if (i === selectedHouseIdx) {
          mat.color.setHex(0x4488ff)
        } else if (i === hoveredIdx) {
          mat.color.setHex(0x88bbff)
        } else {
          mat.color.setHex(0xffffff)
        }
      }

      // Animate clouds (slow drift)
      const t = elapsed * 0.0001
      cloudGroup.children.forEach((cloud, i) => {
        cloud.position.x += 0.002 * (i % 2 === 0 ? 1 : -1)
        if (cloud.position.x > 20) cloud.position.x = -20
        if (cloud.position.x < -20) cloud.position.x = 20
      })

      // Animate birds (circle around)
      birdGroup.children.forEach((bird, i) => {
        const b = bird as THREE.Line
        const angle = b.userData?.angle || 0
        const r = 15 + i * 2
        bird.position.x = Math.cos(angle + t * (1 + i * 0.3)) * r
        bird.position.z = Math.sin(angle + t * (1 + i * 0.3)) * r
        bird.rotation.y = -(angle + t * (1 + i * 0.3)) + Math.PI / 2
      })

      // Animate boats (gentle bobbing)
      boatGroup.children.forEach((boat, i) => {
        boat.position.y = sceneData.yOff - 0.05 + Math.sin(t * 2 + i) * 0.02
      })

      renderer.render(scene, camera)
      animIdRef.current = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      camera.aspect = cw() / ch()
      camera.updateProjectionMatrix()
      renderer.setSize(cw(), ch())
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animIdRef.current)
      window.removeEventListener('resize', onResize)
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('click', onClick)
      if (hoverPauseTimer) clearTimeout(hoverPauseTimer)
      renderer.dispose()
      renderer.domElement.remove()
      labelElsRef.current.forEach(el => el.remove())
      labelElsRef.current = []
      if (tooltipElRef.current) {
        tooltipElRef.current.remove()
        tooltipElRef.current = null
      }
    }
  }, [sceneData])

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const C = isDark ? DARK_COLORS : LIGHT_COLORS

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: `#${C.bg.toString(16).padStart(6, '0')}` }}>
      {loading && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: C.textColor, fontSize: 11, letterSpacing: 7, zIndex: 30,
          fontFamily: 'Courier New, monospace',
        }}>
          LOADING TOPOGRAPHY...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          color: C.errorColor, fontSize: 10, zIndex: 30,
          fontFamily: 'Courier New, monospace',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
