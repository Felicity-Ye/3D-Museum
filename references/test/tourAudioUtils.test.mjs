import assert from 'node:assert/strict'
import test from 'node:test'
import { groupCharacterAlignment } from '../scripts/tour-audio-utils.mjs'

test('TTS character alignment is grouped into sentence captions without estimating times', () => {
  const chars = Array.from('第一句讲解。第二句说明。')
  const alignment = {
    characters: chars,
    character_start_times_seconds: chars.map((_, index) => index * 0.2),
    character_end_times_seconds: chars.map((_, index) => (index + 1) * 0.2),
  }
  assert.deepEqual(groupCharacterAlignment(alignment), [
    { start: 0, end: 1.2, text: '第一句讲解。' },
    { start: 1.2, end: 2.4, text: '第二句说明。' },
  ])
})

test('TTS caption generation rejects incomplete alignments', () => {
  assert.deepEqual(groupCharacterAlignment({ characters: ['字'], character_start_times_seconds: [], character_end_times_seconds: [0.2] }), [])
})
