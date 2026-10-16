import assert from 'node:assert/strict'
import test from 'node:test'
import { getArtifactTour, validateArtifactTours } from '../src/data/artifactTours.js'
import { getArtifactHotspots } from '../src/data/artifactHotspots.js'

test('the bronze tree tour reuses hotspot narration and configures timestamped camera paths', () => {
  const chapters = getArtifactTour('local-qingtongshenshu')
  assert.equal(chapters.length, 4)
  assert.deepEqual(chapters.map(({ hotspotId }) => hotspotId || 'overview'), [
    'overview', 'base', 'branches-and-birds', 'coiling-dragon',
  ])
  assert.ok(chapters[0].audioUrl?.endsWith('/overview.mp3'))
  assert.ok(chapters[0].subtitlesUrl?.endsWith('/overview.subtitles.json'))
  assert.ok(chapters.every((chapter) => chapter.duration > 0 && chapter.cameraKeyframes.length >= 2))
  assert.ok(chapters.every((chapter) => chapter.cameraKeyframes.every((frame) => Number.isFinite(frame.time) && frame.easing)))
  assert.equal(chapters[1].narration, getArtifactHotspots('local-qingtongshenshu')[0].description)
})

test('artifacts without a tour remain unconfigured and bad hotspot references are rejected', () => {
  assert.equal(getArtifactTour('local-qingtongrentouxiang'), null)
  assert.ok(validateArtifactTours({ 'local-artifact': [{
    id: 'missing', title: 'Missing hotspot', hotspotId: 'no-such-hotspot',
    duration: 3, transitionDuration: 1,
  }] }).some((error) => error.includes('unknown hotspotId')))
})
