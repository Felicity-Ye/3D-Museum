import { Html } from '@react-three/drei'
import { getHotspotWorldPose } from '../data/artifactHotspots.js'

function HotspotMarker({ hotspot, modelRootRef, center, onSelect }) {
  function focusHotspot(event) {
    event.preventDefault()
    event.stopPropagation()
    const modelRoot = modelRootRef.current
    if (!modelRoot) return
    onSelect(hotspot, getHotspotWorldPose(modelRoot, center, hotspot))
  }

  return (
    <group position={hotspot.position}>
      <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          className="artifact-hotspot-marker"
          aria-label={hotspot.name}
          title={hotspot.name}
          onClick={focusHotspot}
        >
          <span className="artifact-hotspot-dot" aria-hidden="true" />
          <span className="artifact-hotspot-label">{hotspot.name}</span>
        </button>
      </Html>
    </group>
  )
}

export function ArtifactHotspotMarkers({ hotspots, modelRootRef, center, onSelect }) {
  if (!hotspots.length) return null

  return (
    <group position={[-center.x, -center.y, -center.z]}>
      {hotspots.map((hotspot) => (
        <HotspotMarker
          key={hotspot.id}
          hotspot={hotspot}
          modelRootRef={modelRootRef}
          center={center}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}
