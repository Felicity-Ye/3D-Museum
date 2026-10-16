import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceTour,
  arriveAtTourCamera,
  createTourState,
  exitTour,
  moveTourChapter,
  pauseTour,
  resumeTour,
  startTour,
} from '../src/viewer/tourPlayer.js'

const chapters = [
  { id: 'overview', duration: 5 },
  { id: 'detail', duration: 3 },
]

test('tour starts with a camera transition and begins narration only when it arrives', () => {
  const started = startTour(createTourState(), chapters)
  assert.equal(started.status, 'playing')
  assert.equal(started.phase, 'transition')
  assert.equal(started.chapterIndex, 0)
  assert.equal(advanceTour(started, 2, chapters), started)

  const narrating = arriveAtTourCamera(started, started.requestId)
  assert.equal(narrating.phase, 'narration')
  assert.equal(advanceTour(narrating, 2, chapters).elapsed, 2)
})

test('pausing freezes chapter time and continuing resumes from the same elapsed time', () => {
  const narrating = arriveAtTourCamera(startTour(createTourState(), chapters), 1)
  const paused = pauseTour(advanceTour(narrating, 2, chapters))
  assert.equal(paused.status, 'paused')
  assert.equal(advanceTour(paused, 2, chapters).elapsed, 2)
  assert.equal(resumeTour(paused).status, 'playing')
  assert.equal(advanceTour(resumeTour(paused), 3, chapters).chapterIndex, 1)
})

test('chapter navigation invalidates prior camera work and final chapter returns to overview', () => {
  const started = startTour(createTourState(), chapters)
  const next = moveTourChapter(started, 1, chapters)
  assert.equal(next.chapterIndex, 1)
  assert.equal(next.phase, 'transition')
  assert.notEqual(next.requestId, started.requestId)
  assert.equal(arriveAtTourCamera(next, started.requestId), next)

  const finalNarration = arriveAtTourCamera(next, next.requestId)
  const returning = advanceTour(finalNarration, 3, chapters)
  assert.equal(returning.phase, 'final-transition')
  assert.equal(arriveAtTourCamera(returning, returning.requestId).status, 'completed')
})

test('exit invalidates pending transitions and clears the player state', () => {
  const started = startTour(createTourState(), chapters)
  const exited = exitTour(started)
  assert.equal(exited.status, 'idle')
  assert.equal(exited.phase, 'idle')
  assert.notEqual(exited.requestId, started.requestId)
  assert.equal(arriveAtTourCamera(exited, started.requestId), exited)
})

test('replay starts again at the overview with a fresh request ID', () => {
  const started = startTour(createTourState(), chapters)
  const completed = arriveAtTourCamera(moveTourChapter(started, chapters.length, chapters), 2)
  const replayed = startTour(completed, chapters)
  assert.equal(completed.status, 'completed')
  assert.equal(replayed.status, 'playing')
  assert.equal(replayed.chapterIndex, 0)
  assert.equal(replayed.requestId, completed.requestId + 1)
})
