import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ArtifactHotspotMarkers } from './ArtifactHotspotMarkers.jsx'

// Adapted from 3DCellForge's GeneratedGlbModel: clone GLTF scene/material state,
// center once from its bounding box, and fit its longest axis to the viewer.
export function GeneratedGlbModel({ modelUrl, proofMode = false, viewMode = 'solid', modelScale = 1, modelRotation = [0, 0, 0], onSelect, hotspots = [], onSelectHotspot }) {
  const gltf = useGLTF(modelUrl)
  const modelGroupRef = useRef(null)
  const introProgress = useRef(0)

  const { object, scale, center } = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    const xrayMode = viewMode === 'layers'
    const focusMode = viewMode === 'focus'
    const prepareMaterial = (sourceMaterial) => {
      if (xrayMode) {
        return new THREE.MeshBasicMaterial({
          color: '#60c8df',
          transparent: true,
          opacity: 0.36,
          wireframe: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      }
      const material = sourceMaterial.clone()
      material.side = THREE.DoubleSide
      material.envMapIntensity = Math.max(material.envMapIntensity || 0, focusMode ? 1.75 : 1.15)
      if (focusMode && 'emissive' in material) {
        material.emissive = new THREE.Color('#12384d')
        material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 0.12)
      }
      if (focusMode && 'roughness' in material) material.roughness = Math.min(material.roughness ?? 0.48, 0.36)
      if (focusMode && 'metalness' in material) material.metalness = Math.max(material.metalness ?? 0, 0.04)
      material.needsUpdate = true
      return material
    }

    cloned.traverse((node) => {
      if (!node.isMesh) return
      node.castShadow = true
      node.receiveShadow = true
      node.renderOrder = xrayMode ? 6 : 0
      if (node.material) {
        node.material = Array.isArray(node.material)
          ? node.material.map(prepareMaterial)
          : prepareMaterial(node.material)
      }
    })

    const bounds = new THREE.Box3().setFromObject(cloned)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const longestAxis = Math.max(size.x, size.y, size.z) || 1
    cloned.position.sub(center)

    return { object: cloned, scale: 3.25 / longestAxis, center }
  }, [gltf.scene, viewMode])

  useFrame((_, delta) => {
    if (introProgress.current >= 1 || !modelGroupRef.current) return
    introProgress.current = Math.min(1, introProgress.current + delta * 2.6)
    const eased = 1 - (1 - introProgress.current) ** 3
    modelGroupRef.current.scale.setScalar(scale * modelScale * (proofMode ? 0.92 : 1) * (0.92 + eased * 0.08))
  })

  return (
    <group
      ref={modelGroupRef}
      scale={scale * modelScale * (proofMode ? 0.92 : 1) * 0.92}
      rotation={modelRotation}
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.('model')
      }}
    >
      <primitive object={object} />
      <ArtifactHotspotMarkers
        hotspots={hotspots}
        modelRootRef={modelGroupRef}
        center={center}
        onSelect={onSelectHotspot}
      />
    </group>
  )
}
