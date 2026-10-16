import assert from 'node:assert/strict'
import test from 'node:test'
import { Vector3 } from 'three'
import { cameraPoseAtTime, easeProgress, subtitleAtTime } from '../src/viewer/tourTimeline.js'

test('subtitle lookup follows half-open timestamp ranges', () => {
  const subtitles = [
    { start: 0, end: 1, text: '第一句' },
    { start: 1.2, end: 2, text: '第二句' },
  ]
  assert.equal(subtitleAtTime(subtitles, 0.5).text, '第一句')
  assert.equal(subtitleAtTime(subtitles, 1), null)
  assert.equal(subtitleAtTime(subtitles, 1.5).text, '第二句')
  assert.equal(subtitleAtTime(subtitles, 2), null)
})

test('camera keyframe interpolation is deterministic at arbitrary seek positions', () => {
  const frames = [
    { time: 0, id: 'start', easing: 'linear' },
    { time: 4, id: 'end', easing: 'linear' },
  ]
  const resolve = ({ id }) => ({
    position: new Vector3(id === 'start' ? 0 : 8, 0, 0),
    target: new Vector3(id === 'start' ? 0 : 4, 0, 0),
  })
  const atOneSecond = cameraPoseAtTime(frames, 1, resolve)
  const afterSeek = cameraPoseAtTime(frames, 1, resolve)
  assert.deepEqual(atOneSecond.position.toArray(), [2, 0, 0])
  assert.deepEqual(afterSeek.position.toArray(), atOneSecond.position.toArray())
  assert.deepEqual(cameraPoseAtTime(frames, 4, resolve).position.toArray(), [8, 0, 0])
})

test('camera easing can be evaluated at any time without accumulated deltas', () => {
  assert.equal(easeProgress(0.5, 'linear'), 0.5)
  assert.equal(easeProgress(0.5, 'ease-in'), 0.25)
  assert.equal(easeProgress(0.5, 'ease-out'), 0.75)
  assert.equal(easeProgress(0.5), 0.5)
})
