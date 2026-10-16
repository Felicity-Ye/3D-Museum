import tourConfig from './artifact-tours.json' with { type: 'json' }
import { getArtifactHotspots } from './artifactHotspots.js'

function validateChapter(artifactId, chapter, index, hotspots) {
  const label = `${artifactId}[${index}]`
  const errors = []
  if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) return [`${label}: chapter must be an object`]
  if (typeof chapter.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter.id)) errors.push(`${label}: invalid chapter ID`)
  if (typeof chapter.title !== 'string' || !chapter.title.trim()) errors.push(`${label}: title must be a non-empty string`)
  const hotspot = hotspots.find((item) => item.id === chapter.hotspotId)
  if ((!chapter.narration || typeof chapter.narration !== 'string' || !chapter.narration.trim()) && !hotspot?.description) errors.push(`${label}: narration must be provided directly or by its hotspot`)
  if (!Number.isFinite(chapter.duration) || chapter.duration <= 0) errors.push(`${label}: duration must be positive`)
  if (!Number.isFinite(chapter.transitionDuration) || chapter.transitionDuration <= 0) errors.push(`${label}: transitionDuration must be positive`)
  if (chapter.audioUrl !== null && chapter.audioUrl !== undefined && typeof chapter.audioUrl !== 'string') errors.push(`${label}: audioUrl must be a string or null`)
  if (chapter.hotspotId && !hotspot) errors.push(`${label}: unknown hotspotId ${chapter.hotspotId}`)
  if (chapter.cameraPreset && chapter.cameraPreset !== 'overview') errors.push(`${label}: unsupported cameraPreset`)
  if (!chapter.hotspotId && !chapter.cameraPreset) errors.push(`${label}: a hotspotId or cameraPreset is required`)
  return errors
}

export function validateArtifactTours(config = tourConfig, hotspotGetter = getArtifactHotspots) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['tour configuration must be an object keyed by artifact ID']
  const errors = []
  for (const [artifactId, chapters] of Object.entries(config)) {
    if (!Array.isArray(chapters) || chapters.length === 0) {
      errors.push(`${artifactId}: chapters must be a non-empty array`)
      continue
    }
    const hotspots = hotspotGetter(artifactId)
    const ids = new Set()
    chapters.forEach((chapter, index) => {
      errors.push(...validateChapter(artifactId, chapter, index, hotspots))
      if (typeof chapter?.id === 'string') {
        if (ids.has(chapter.id)) errors.push(`${artifactId}: duplicate chapter ID ${chapter.id}`)
        ids.add(chapter.id)
      }
    })
  }
  return errors
}

export function getArtifactTour(artifactId, config = tourConfig, hotspotGetter = getArtifactHotspots) {
  const chapters = config?.[artifactId]
  if (!Array.isArray(chapters) || !chapters.length) return null
  const hotspots = hotspotGetter(artifactId)
  const ids = new Set()
  const valid = chapters.filter((chapter, index) => {
    if (validateChapter(artifactId, chapter, index, hotspots).length || ids.has(chapter.id)) return false
    ids.add(chapter.id)
    return true
  })
  if (valid.length !== chapters.length) return null
  return valid.map((chapter) => ({
    ...chapter,
    audioUrl: chapter.audioUrl ?? null,
    narration: chapter.narration || hotspots.find((hotspot) => hotspot.id === chapter.hotspotId)?.description || '',
  }))
}
