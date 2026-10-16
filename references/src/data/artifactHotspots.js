import hotspotConfig from './artifact-hotspots.json' with { type: 'json' }
import { Vector3 } from 'three'

function isVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
}

function sourceIsHttpUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

function validateRecord(artifactId, hotspot, index) {
  const errors = []
  const label = `${artifactId}[${index}]`
  if (!hotspot || typeof hotspot !== 'object' || Array.isArray(hotspot)) {
    return [`${label}: hotspot must be an object`]
  }
  if (typeof hotspot.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hotspot.id)) errors.push(`${label}: invalid hotspot ID`)
  for (const field of ['name', 'description']) {
    if (typeof hotspot[field] !== 'string' || !hotspot[field].trim()) errors.push(`${label}: ${field} must be a non-empty string`)
  }
  for (const field of ['position', 'cameraOffset']) {
    if (!isVector3(hotspot[field])) errors.push(`${label}: ${field} must contain exactly three finite numbers`)
  }
  if (typeof hotspot.sourceUrl !== 'string' || !sourceIsHttpUrl(hotspot.sourceUrl)) errors.push(`${label}: sourceUrl must be a valid HTTP(S) URL`)
  if (hotspot.verified !== true) errors.push(`${label}: verified must be true`)
  return errors
}

export function validateArtifactHotspots(config = hotspotConfig) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['hotspot configuration must be an object keyed by artifact ID']

  const errors = []
  for (const [artifactId, hotspots] of Object.entries(config)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artifactId)) errors.push(`${artifactId}: invalid artifact ID`)
    if (!Array.isArray(hotspots)) {
      errors.push(`${artifactId}: hotspots must be an array`)
      continue
    }
    const ids = new Set()
    hotspots.forEach((hotspot, index) => {
      errors.push(...validateRecord(artifactId, hotspot, index))
      if (typeof hotspot?.id === 'string') {
        if (ids.has(hotspot.id)) errors.push(`${artifactId}: duplicate hotspot ID ${hotspot.id}`)
        ids.add(hotspot.id)
      }
    })
  }
  return errors
}

export function getArtifactHotspots(artifactId, config = hotspotConfig) {
  const hotspots = config?.[artifactId]
  if (!Array.isArray(hotspots)) return []

  const ids = new Set()
  return hotspots.filter((hotspot, index) => {
    if (validateRecord(artifactId, hotspot, index).length || ids.has(hotspot.id)) return false
    ids.add(hotspot.id)
    return true
  })
}

export function getHotspotWorldPose(modelRoot, center, hotspot) {
  const centerVector = center instanceof Vector3 ? center : new Vector3(...center)
  const position = new Vector3(...hotspot.position).sub(centerVector)
  const cameraPosition = new Vector3(...hotspot.position).add(new Vector3(...hotspot.cameraOffset)).sub(centerVector)

  modelRoot.updateWorldMatrix(true, false)
  return {
    target: modelRoot.localToWorld(position),
    position: modelRoot.localToWorld(cameraPosition),
  }
}
