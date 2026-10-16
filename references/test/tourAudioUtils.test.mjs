import assert from 'node:assert/strict'
import test from 'node:test'
import { groupCharacterAlignment, groupTimedSubtitles, parseSrtSubtitles, restoreSubtitlePunctuation, speedToEdgeRate } from '../scripts/tour-audio-utils.mjs'

test('Edge TTS sentence subtitles are parsed from SRT timestamps without estimating timing', () => {
  const srt = `1\n00:00:00,120 --> 00:00:02,480\n先从整体观察这件文物。\n\n2\n00:00:02,600 --> 00:00:05,040\n它展现了古蜀人的想象力。\n`
  assert.deepEqual(parseSrtSubtitles(srt), [
    { start: 0.12, end: 2.48, text: '先从整体观察这件文物。' },
    { start: 2.6, end: 5.04, text: '它展现了古蜀人的想象力。' },
  ])
})

test('SRT subtitles with invalid or empty cues are ignored', () => {
  assert.deepEqual(parseSrtSubtitles('1\nnot a time\n\n2\n00:00:01,000 --> 00:00:01,000\ninvalid duration\n'), [])
})

test('timed word cues are grouped into readable sentences using source timestamps', () => {
  assert.deepEqual(groupTimedSubtitles([
    { start: 0.1, end: 0.3, text: '三星堆' },
    { start: 0.3, end: 0.6, text: '青铜神树，' },
    { start: 0.6, end: 0.9, text: '展现了古蜀人的想象。' },
  ]), [
    { start: 0.1, end: 0.9, text: '三星堆青铜神树，展现了古蜀人的想象。' },
  ])
})

test('subtitle grouping keeps short sentence endings with the preceding cue', () => {
  assert.deepEqual(groupTimedSubtitles([
    { start: 4.995, end: 9.266, text: '三面间以三足相连，构拟出三山相连的“神山”' },
    { start: 9.279, end: 9.782, text: '意象。' },
  ]), [
    { start: 4.995, end: 9.782, text: '三面间以三足相连，构拟出三山相连的“神山”意象。' },
  ])
})

test('speech speed multipliers convert to Edge TTS percentage rates', () => {
  assert.equal(speedToEdgeRate(0.92), '-8%')
  assert.equal(speedToEdgeRate(1), '+0%')
  assert.equal(speedToEdgeRate(1.1), '+10%')
})

test('word boundary subtitles recover punctuation from the reviewed narration text', () => {
  assert.deepEqual(restoreSubtitlePunctuation([
    { start: 0.1, end: 0.5, text: '三星堆青铜神树' },
    { start: 0.6, end: 1.2, text: '展现了古蜀人的想象力' },
  ], '三星堆青铜神树，展现了古蜀人的想象力。'), [
    { start: 0.1, end: 0.5, text: '三星堆青铜神树，' },
    { start: 0.6, end: 1.2, text: '展现了古蜀人的想象力。' },
  ])
})

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
