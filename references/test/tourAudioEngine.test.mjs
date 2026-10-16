import assert from 'node:assert/strict'
import test from 'node:test'
import { TourAudioEngine } from '../src/viewer/tourAudioEngine.js'

class FakeAudio {
  listeners = new Map()
  currentTime = 0
  duration = 8
  volume = 1
  muted = false
  src = ''
  paused = true
  addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) || []), listener]) }
  removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) || []).filter((item) => item !== listener)) }
  removeAttribute(name) { if (name === 'src') this.src = '' }
  load() {}
  pause() { this.paused = true }
  async play() { this.paused = false }
  dispatch(name) { for (const listener of this.listeners.get(name) || []) listener() }
}

test('audio engine keeps one track, stops stale ended handlers, and applies pause, seek, volume, and mute', async () => {
  const audio = new FakeAudio()
  const ended = []
  const engine = new TourAudioEngine(audio, { onEnded: (token) => ended.push(token) })
  const oldToken = { requestId: 1 }
  engine.load('/old.mp3', oldToken)
  const oldEnded = audio.listeners.get('ended')[0]
  const currentToken = { requestId: 2 }
  const generation = engine.load('/new.mp3', currentToken)
  oldEnded()
  audio.dispatch('ended')
  assert.deepEqual(ended, [currentToken])
  assert.equal(await engine.play(generation), true)
  engine.pause()
  engine.seek(3.2)
  engine.setVolume(0.4)
  engine.setMuted(true)
  assert.equal(audio.paused, true)
  assert.equal(audio.currentTime, 3.2)
  assert.equal(audio.volume, 0.4)
  assert.equal(audio.muted, true)
  engine.destroy()
  assert.equal(audio.src, '')
})
