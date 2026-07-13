import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useCardStore } from '../../stores/cardStore'
import { usePanelStore } from '../../stores/panelStore'
import { useViewStore } from '../../stores/viewStore'
import { buildHouses, updateSilhouette } from './houseGeometry'
import type { TopicPeak } from './types'
import type { useContourScene } from './useContourScene'

type TopographyColors = {
  bg: number
  fog: number
  fogDensity: number
  ambientColor: number
  ambientIntensity: number
  starColor: number
  contourLine: number
  contourFill: number
  compassColor: number
  labelBg: string
  labelColor: string
}

interface TopographySceneProps {
  peaks: TopicPeak[]
  sceneData: ReturnType<typeof useContourScene>
  colors: TopographyColors
}

export function TopographyScene({ peaks, sceneData, colors: C }: TopographySceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animIdRef = useRef<number>(0)
  const labelElsRef = useRef<HTMLDivElement[]>([])
  const tooltipElRef = useRef<HTMLDivElement | null>(null)
  const peaksRef = useRef<TopicPeak[]>([])

  peaksRef.current = peaks

  // Update label DOM text when peaks labels change (LLM naming), without rebuilding the scene.
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
    if (!container || !sceneData.mountainGroup || !sceneData.H || !sceneData.contourLevels) return

    const isDark = C.bg === 0x00000f

    // Build card title map from store snapshot (stable reference within this effect).
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

    // Override contour materials for light mode.
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

    const { houses, houseWorldPositions } = buildHouses(
      peaksRef.current,
      cardTitles,
      sceneData.H,
      sceneData.yOff,
      sceneData.contourLevels,
    )
    const houseGroup = new THREE.Group()
    houseGroup.visible = false
    for (const house of houses) {
      houseGroup.add(house.fillMesh)
      houseGroup.add(house.outlineMesh)
      houseGroup.add(house.hitMesh)
    }
    scene.add(houseGroup)

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

    const boatGroup = new THREE.Group()
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
    }
    scene.add(boatGroup)

    const starN = 2800
    const starPos = new Float32Array(starN * 3)
    for (let i = 0; i < starN * 3; i++) starPos[i] = (Math.random() - 0.5) * 280
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: C.starColor, size: 0.14, transparent: true, opacity: 0.5,
    })))

    const COMP_Y = sceneData.yOff - 0.09
    const COMP_R = 9.4
    const cg = new THREE.Group()
    cg.position.y = COMP_Y
    scene.add(cg)

    const rg = new THREE.RingGeometry(COMP_R - 0.08, COMP_R + 0.09, 128)
    rg.rotateX(-Math.PI / 2)
    cg.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
      color: C.compassColor, transparent: true, opacity: 0.20, side: THREE.DoubleSide,
    })))

    const dr = new THREE.RingGeometry(COMP_R * 0.87, COMP_R * 0.89, 96)
    dr.rotateX(-Math.PI / 2)
    cg.add(new THREE.Mesh(dr, new THREE.MeshBasicMaterial({
      color: C.compassColor, transparent: true, opacity: 0.09, side: THREE.DoubleSide,
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
      color: C.compassColor, transparent: true, opacity: 0.32,
    })))

    labelElsRef.current.forEach(el => el.remove())
    labelElsRef.current = []

    for (const a of sceneData.anchorPositions) {
      const peak = peaksRef.current.find(p => p.id === a.id)
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;pointer-events:auto;cursor:default;z-index:5;' +
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

    let tooltipEl = tooltipElRef.current
    if (!tooltipEl) {
      tooltipEl = document.createElement('div')
      tooltipEl.style.cssText = 'position:absolute;z-index:5;pointer-events:none;' +
        'background:rgba(0,0,0,.72);color:rgba(255,255,255,.9);font-size:10px;' +
        'padding:3px 8px;border-radius:4px;white-space:nowrap;font-family:Courier New,monospace;' +
        'opacity:0;transition:opacity .15s;transform:translate(-50%,-100%);'
      container.appendChild(tooltipEl)
      tooltipElRef.current = tooltipEl
    }

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

        useViewStore.getState().setEditingCardId(hd.cardId)
        usePanelStore.getState().setRightPanelActiveTab('editor')
        usePanelStore.getState().setRightPanelCollapsed(false)

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

        selectedHouseIdx = hitIdx
        for (let i = 0; i < houses.length; i++) {
          const mat = houses[i].outlineMesh.material as THREE.LineBasicMaterial
          mat.color.set(i === hitIdx ? 0x2266dd : 0x000000)
          mat.opacity = i === hitIdx ? 1.0 : 0.3
        }

        for (const c of sceneData.contours) {
          if (!c.fill) continue
          const fillPos = c.fill.position
          const dist = Math.sqrt((fillPos.x - hd.x) ** 2 + (fillPos.z - hd.z) ** 2)
          const mat = c.fill.material as THREE.MeshBasicMaterial
          mat.opacity = dist < 3.0 ? 0.12 : 0.58
        }
      }
    }
    container.addEventListener('click', onClick)

    const ENTRY_START = 400, LAYER_STAGGER = 45, LAYER_FADE_MS = 380, RISE_AMOUNT = 0.35
    const sortedContours = [...sceneData.contours].sort((a, b) => a.level - b.level)
    let rank = -1, prevLevel = -Infinity
    const contourAnim = sortedContours.map(c => {
      if (c.level !== prevLevel) { rank++; prevLevel = c.level }
      return { ...c, startAt: ENTRY_START + rank * LAYER_STAGGER, appeared: false }
    })
    const ENTRY_TOTAL = contourAnim.length > 0
      ? contourAnim[contourAnim.length - 1].startAt + LAYER_FADE_MS + 400
      : 2000

    const t0 = performance.now()
    let entryDone = false, anchorsShown = false

    const _v = new THREE.Vector3()
    const cw = () => container.clientWidth
    const ch = () => container.clientHeight

    function animate() {
      const elapsed = performance.now() - t0
      controls.update()

      if (!entryDone) {
        for (const c of contourAnim) {
          if (elapsed >= c.startAt && !c.appeared) {
            const p = Math.min((elapsed - c.startAt) / LAYER_FADE_MS, 1)
            const ease = 1 - Math.pow(1 - p, 3)
            c.line.visible = false
            if (c.tube) {
              c.tube.visible = true
              const tMat = c.tube.material as THREE.MeshBasicMaterial
              tMat.opacity = 0.88 * ease
              c.tube.position.y = -RISE_AMOUNT * (1 - ease)
            }
            if (c.fill) {
              c.fill.visible = true
              const fMat = c.fill.material as THREE.MeshBasicMaterial
              fMat.opacity = 0.58 * ease
              c.fill.position.y = c.level - RISE_AMOUNT * (1 - ease)
            }
            if (p >= 1) c.appeared = true
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

      for (let i = 0; i < sceneData.anchorPositions.length; i++) {
        const a = sceneData.anchorPositions[i]
        const el = labelElsRef.current[i]
        if (!el) continue
        _v.copy(a.worldPos).project(camera)
        if (_v.z > 1) { el.style.opacity = '0'; continue }
        if (entryDone || elapsed > 600) el.style.opacity = '1'
        const lx = (_v.x * 0.5 + 0.5) * cw()
        const rawLy = (-_v.y * 0.5 + 0.5) * ch()
        const ly = Math.max(20, Math.min(rawLy, ch() - 4))
        el.style.left = lx + 'px'
        el.style.top = ly + 'px'
      }

      const camDir = new THREE.Vector3()
      camera.getWorldDirection(camDir)
      camDir.negate()
      for (const house of houses) {
        updateSilhouette(house, camDir)
      }

      raycaster.setFromCamera(mouse, camera)
      const hitMeshes = houses.map(h => h.hitMesh)
      const intersects = raycaster.intersectObjects(hitMeshes, false)

      if (intersects.length > 0) {
        const hitIdx = hitMeshes.indexOf(intersects[0].object as THREE.Mesh)
        if (hitIdx !== hoveredIdx) {
          hoveredIdx = hitIdx
        }
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
          if (hoverPauseTimer) clearTimeout(hoverPauseTimer)
          hoverPauseTimer = setTimeout(() => {
            isHoverPaused = false
            controls.autoRotate = true
          }, 1500)
        }
        hoveredIdx = -1
        tooltipEl!.style.opacity = '0'
      }

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

      const t = elapsed * 0.0001
      cloudGroup.children.forEach((cloud, i) => {
        cloud.position.x += 0.002 * (i % 2 === 0 ? 1 : -1)
        if (cloud.position.x > 20) cloud.position.x = -20
        if (cloud.position.x < -20) cloud.position.x = 20
      })

      birdGroup.children.forEach((bird, i) => {
        const b = bird as THREE.Line
        const angle = b.userData?.angle || 0
        const r = 15 + i * 2
        bird.position.x = Math.cos(angle + t * (1 + i * 0.3)) * r
        bird.position.z = Math.sin(angle + t * (1 + i * 0.3)) * r
        bird.rotation.y = -(angle + t * (1 + i * 0.3)) + Math.PI / 2
      })

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
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      labelElsRef.current.forEach(el => el.remove())
      labelElsRef.current = []
      if (tooltipElRef.current) {
        tooltipElRef.current.remove()
        tooltipElRef.current = null
      }
    }
  }, [C, sceneData])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />
}
