import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { usePanelStore } from '../../stores/panelStore'
import { useViewStore } from '../../stores/viewStore'
import type { HouseData, HouseWorldPosition } from './houseGeometry'

interface ContourSlice {
  fill: THREE.Mesh | null
}

interface AttachInteractionArgs {
  container: HTMLDivElement
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  houses: HouseData[]
  houseWorldPositions: HouseWorldPosition[]
  contours: ContourSlice[]
}

interface UpdateInteractionArgs {
  camera: THREE.PerspectiveCamera
  houses: HouseData[]
  houseWorldPositions: HouseWorldPosition[]
  tooltipEl: HTMLDivElement
  projectVector: THREE.Vector3
  width: number
  height: number
}

export function useTopographyInteraction() {
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const hoveredIdxRef = useRef(-1)
  const selectedHouseIdxRef = useRef(-1)
  const hoverPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoverPausedRef = useRef(false)

  const clearHoverPauseTimer = useCallback(() => {
    if (hoverPauseTimerRef.current) {
      clearTimeout(hoverPauseTimerRef.current)
      hoverPauseTimerRef.current = null
    }
  }, [])

  const attach = useCallback(({
    container,
    camera,
    controls,
    houses,
    houseWorldPositions,
    contours,
  }: AttachInteractionArgs) => {
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const clickMouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycasterRef.current.setFromCamera(clickMouse, camera)
      const clickHitMeshes = houses.map(h => h.hitMesh)
      const intersects = raycasterRef.current.intersectObjects(clickHitMeshes, false)
      if (intersects.length === 0) return

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

      selectedHouseIdxRef.current = hitIdx
      for (let i = 0; i < houses.length; i++) {
        const mat = houses[i].outlineMesh.material as THREE.LineBasicMaterial
        mat.color.set(i === hitIdx ? 0x2266dd : 0x000000)
        mat.opacity = i === hitIdx ? 1.0 : 0.3
      }

      for (const c of contours) {
        if (!c.fill) continue
        const fillPos = c.fill.position
        const dist = Math.sqrt((fillPos.x - hd.x) ** 2 + (fillPos.z - hd.z) ** 2)
        const mat = c.fill.material as THREE.MeshBasicMaterial
        mat.opacity = dist < 3.0 ? 0.12 : 0.58
      }
    }

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('click', onClick)

    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('click', onClick)
      clearHoverPauseTimer()
      hoveredIdxRef.current = -1
      selectedHouseIdxRef.current = -1
      isHoverPausedRef.current = false
    }
  }, [clearHoverPauseTimer])

  const updateFrame = useCallback(({
    camera,
    houses,
    houseWorldPositions,
    tooltipEl,
    projectVector,
    width,
    height,
  }: UpdateInteractionArgs) => {
    raycasterRef.current.setFromCamera(mouseRef.current, camera)
    const hitMeshes = houses.map(h => h.hitMesh)
    const intersects = raycasterRef.current.intersectObjects(hitMeshes, false)

    if (intersects.length > 0) {
      const hitIdx = hitMeshes.indexOf(intersects[0].object as THREE.Mesh)
      if (hitIdx !== hoveredIdxRef.current) {
        hoveredIdxRef.current = hitIdx
      }
      if (!isHoverPausedRef.current) {
        isHoverPausedRef.current = true
        clearHoverPauseTimer()
      }
      const hd = houseWorldPositions[hoveredIdxRef.current]
      if (hd) {
        projectVector.set(hd.x, hd.y, hd.z).project(camera)
        tooltipEl.style.opacity = '1'
        const tx = (projectVector.x * 0.5 + 0.5) * width
        const ty = Math.max(16, (-projectVector.y * 0.5 + 0.5) * height)
        tooltipEl.style.left = `${tx}px`
        tooltipEl.style.top = `${ty}px`
        tooltipEl.textContent = hd.title
      }
    } else {
      if (hoveredIdxRef.current !== -1) {
        clearHoverPauseTimer()
        hoverPauseTimerRef.current = setTimeout(() => {
          isHoverPausedRef.current = false
        }, 1500)
      }
      hoveredIdxRef.current = -1
      tooltipEl.style.opacity = '0'
    }

    for (let i = 0; i < houses.length; i++) {
      const mat = houses[i].fillMesh.material as THREE.MeshBasicMaterial
      if (i === selectedHouseIdxRef.current) {
        mat.color.setHex(0x4488ff)
      } else if (i === hoveredIdxRef.current) {
        mat.color.setHex(0x88bbff)
      } else {
        mat.color.setHex(0xffffff)
      }
    }

    return isHoverPausedRef.current
  }, [clearHoverPauseTimer])

  return { attach, updateFrame }
}
