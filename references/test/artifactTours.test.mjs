import assert from 'node:assert/strict'
import test from 'node:test'
import { getArtifactTour, validateArtifactTours } from '../src/data/artifactTours.js'
import { getArtifactHotspots } from '../src/data/artifactHotspots.js'

test('the bronze tree tour reuses all three configured hotspots and reserves audio URLs', () => {
  const chapters = getArtifactTour('local-qingtongshenshu')
  assert.equal(chapters.length, 4)
  assert.deepEqual(chapters.map(({ hotspotId }) => hotspotId || 'overview'), [
    'overview', 'base', 'branches-and-birds', 'coiling-dragon',
  ])
  assert.ok(chapters.every((chapter) => chapter.audioUrl === null && chapter.duration > 0))
  assert.equal(chapters[1].narration, getArtifactHotspots('local-qingtongshenshu')[0].description)
})

test('artifacts without a tour remain unconfigured and bad hotspot references are rejected', () => {
  assert.equal(getArtifactTour('local-qingtongrentouxiang'), null)
  assert.ok(validateArtifactTours({ 'local-artifact': [{
    id: 'missing', title: 'Missing hotspot', hotspotId: 'no-such-hotspot',
    duration: 3, transitionDuration: 1,
  }] }).some((error) => error.includes('unknown hotspotId')))
})
