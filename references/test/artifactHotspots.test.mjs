import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, MathUtils, Vector3 } from 'three'
import {
  getArtifactHotspots,
  getHotspotWorldPose,
  validateArtifactHotspots,
} from '../src/data/artifactHotspots.js'
import { advanceCameraPose, interpolateCameraPose } from '../src/viewer/cameraTransition.js'

const validHotspot = {
  id: 'base',
  name: '底座',
  description: '三面弧边三角形镂空底座。',
  position: [2, 1, 0],
  cameraOffset: [0, 0, 1],
  sourceUrl: 'https://www.sxd.cn/relics/',
  verified: true,
}

test('hotspots are associated by artifact ID and missing records return an empty list', () => {
  const config = { 'local-artifact-a': [validHotspot] }
  assert.deepEqual(getArtifactHotspots('local-artifact-a', config), [validHotspot])
  assert.deepEqual(getArtifactHotspots('local-artifact-b', config), [])
  assert.deepEqual(getArtifactHotspots('local-artifact-a'), [])
})

test('officially sourced verified hotspot configuration passes validation', () => {
  assert.deepEqual(validateArtifactHotspots({ 'local-artifact-a': [validHotspot] }), [])
})

test('the bronze tree example contains three verified hotspots with museum sources', () => {
  const hotspots = getArtifactHotspots('local-qingtongshenshu')
  assert.equal(hotspots.length, 3)
  assert.deepEqual(validateArtifactHotspots(), [])
  assert.ok(hotspots.every((hotspot) => hotspot.verified && hotspot.sourceUrl.startsWith('https://www.sxd.cn/')))
})

test('duplicate IDs, invalid coordinates, unverifiable sources, and unverified claims fail validation', () => {
  const config = {
    'local-artifact-a': [
      validHotspot,
      { ...validHotspot, name: '重名热点' },
      { ...validHotspot, id: 'bad-position', position: [0, Number.NaN, 1] },
      { ...validHotspot, id: 'bad-offset', cameraOffset: [0, 1] },
      { ...validHotspot, id: 'bad-source', sourceUrl: 'javascript:alert(1)' },
      { ...validHotspot, id: 'not-verified', verified: false },
    ],
  }
  const errors = validateArtifactHotspots(config)
  assert.ok(errors.some((error) => error.includes('duplicate hotspot ID')))
  assert.ok(errors.some((error) => error.includes('position')))
  assert.ok(errors.some((error) => error.includes('cameraOffset')))
  assert.ok(errors.some((error) => error.includes('sourceUrl')))
  assert.ok(errors.some((error) => error.includes('verified')))
})

test('hotspot focus and camera offset share center, model position, rotation, and scale transforms', () => {
  const modelRoot = new Group()
  modelRoot.position.set(2, 3, 4)
  modelRoot.rotation.y = MathUtils.degToRad(90)
  modelRoot.scale.setScalar(2)

  const pose = getHotspotWorldPose(modelRoot, new Vector3(1, 0, 0), validHotspot)
  assert.ok(pose.target.distanceTo(new Vector3(2, 5, 2)) < 1e-9)
  assert.ok(pose.position.distanceTo(new Vector3(4, 5, 2)) < 1e-9)
})

test('camera focus advances smoothly and reports completion at the destination', () => {
  const startPosition = new Vector3(0, 0, 5)
  const startTarget = new Vector3(0, 0, 0)
  const destination = new Vector3(1, 2, 3)
  const destinationTarget = new Vector3(0.5, 0.8, 0)
  const firstFrame = advanceCameraPose(startPosition, startTarget, destination, destinationTarget, 1 / 60)

  assert.ok(firstFrame.position.distanceTo(startPosition) > 0)
  assert.ok(firstFrame.position.distanceTo(destination) < startPosition.distanceTo(destination))
  assert.equal(firstFrame.finished, false)

  const finalPose = advanceCameraPose(destination.clone(), destinationTarget.clone(), destination, destinationTarget, 1 / 60)
  assert.equal(finalPose.finished, true)
  assert.ok(finalPose.position.equals(destination))
  assert.ok(finalPose.target.equals(destinationTarget))
})

test('timed camera interpolation eases both position and target and finishes at its duration', () => {
  const startPosition = new Vector3(0, 0, 5)
  const startTarget = new Vector3(0, 0, 0)
  const destination = new Vector3(1, 2, 3)
  const destinationTarget = new Vector3(0.5, 0.8, 0)
  const middle = interpolateCameraPose(startPosition, startTarget, destination, destinationTarget, 1, 2)
  assert.equal(middle.finished, false)
  assert.ok(middle.position.distanceTo(startPosition) > 0)
  assert.ok(middle.target.distanceTo(startTarget) > 0)
  const final = interpolateCameraPose(startPosition, startTarget, destination, destinationTarget, 2, 2)
  assert.equal(final.finished, true)
  assert.ok(final.position.equals(destination))
  assert.ok(final.target.equals(destinationTarget))
})
