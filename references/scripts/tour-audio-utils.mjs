const SENTENCE_END = /[。！？!?；;]/u
const SOFT_BREAK = /[，,：:]$/u
const PUNCTUATION = /^[，。！？!?；;：:,、“”‘’（）()《》〈〉【】『』"'…—-]$/u

function parseSrtTime(timestamp) {
  const match = timestamp.match(/^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})$/u)
  if (!match) return null
  const [, hours, minutes, seconds, milliseconds] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds) / 1000
}

export function parseSrtSubtitles(srt) {
  if (typeof srt !== 'string') return []
  const blocks = srt.replace(/^\uFEFF/u, '').trim().split(/\r?\n\s*\r?\n/u)
  const subtitles = []

  for (const block of blocks) {
    const lines = block.split(/\r?\n/u).map((line) => line.trim())
    const timeLineIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeLineIndex < 0) continue
    const [startValue, endValue] = lines[timeLineIndex].split('-->').map((value) => value.trim())
    const start = parseSrtTime(startValue)
    const end = parseSrtTime(endValue)
    const text = lines.slice(timeLineIndex + 1).join(' ').trim()
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) subtitles.push({ start, end, text })
  }
  return subtitles
}

export function speedToEdgeRate(speed) {
  const percentage = Math.round((speed - 1) * 100)
  return `${percentage >= 0 ? '+' : ''}${percentage}%`
}

export function restoreSubtitlePunctuation(cues, narration) {
  if (!Array.isArray(cues) || typeof narration !== 'string') return cues ?? []
  const source = Array.from(narration)
  let sourceIndex = 0

  return cues.map((cue) => {
    let text = ''
    for (const character of Array.from(cue.text ?? '')) {
      if (/\s/u.test(character)) {
        text += character
        continue
      }
      while (sourceIndex < source.length && PUNCTUATION.test(source[sourceIndex])) text += source[sourceIndex++]
      if (source[sourceIndex] === character) {
        sourceIndex += 1
      } else {
        let matchIndex = source.indexOf(character, sourceIndex)
        while (matchIndex > sourceIndex && !source.slice(sourceIndex, matchIndex).some((part) => !PUNCTUATION.test(part))) matchIndex = source.indexOf(character, matchIndex + 1)
        if (matchIndex >= sourceIndex) {
          while (sourceIndex < matchIndex) text += source[sourceIndex++]
          sourceIndex += 1
        }
      }
      text += character
      while (sourceIndex < source.length && PUNCTUATION.test(source[sourceIndex])) text += source[sourceIndex++]
    }
    return { ...cue, text }
  })
}

export function groupTimedSubtitles(cues, maxCharacters = 26) {
  if (!Array.isArray(cues)) return []
  const subtitles = []
  let text = ''
  let start = null
  let end = null
  const flush = () => {
    const clean = text.trim()
    if (clean && Number.isFinite(start) && Number.isFinite(end) && end > start) {
      subtitles.push({ start: Number(start.toFixed(6)), end: Number(end.toFixed(6)), text: clean })
    }
    text = ''
    start = null
    end = null
  }

  for (const cue of cues) {
    if (!Number.isFinite(cue?.start) || !Number.isFinite(cue?.end) || cue.end <= cue.start || typeof cue.text !== 'string' || !cue.text.trim()) continue
    const cueText = cue.text.trim()
    if (text && Array.from(text).length + Array.from(cueText).length > maxCharacters) flush()
    if (start === null) start = cue.start
    text += cueText
    end = cue.end
    const count = Array.from(text).length
    const lastCharacter = Array.from(text).at(-1)
    if (SENTENCE_END.test(lastCharacter) || count >= maxCharacters || (count >= maxCharacters - 4 && SOFT_BREAK.test(text))) flush()
  }
  flush()
  return subtitles
}

export function groupCharacterAlignment(alignment, maxCharacters = 22) {
  const characters = alignment?.characters
  const starts = alignment?.character_start_times_seconds
  const ends = alignment?.character_end_times_seconds
  if (!Array.isArray(characters) || !Array.isArray(starts) || !Array.isArray(ends) || characters.length !== starts.length || starts.length !== ends.length) return []

  const subtitles = []
  let text = ''
  let start = null
  let end = null
  const roundTime = (time) => Number(time.toFixed(6))
  const flush = () => {
    const clean = text.trim()
    if (clean && Number.isFinite(start) && Number.isFinite(end) && end > start) subtitles.push({ start: roundTime(start), end: roundTime(end), text: clean })
    text = ''
    start = null
    end = null
  }

  for (let index = 0; index < characters.length; index += 1) {
    const character = String(characters[index] ?? '')
    if (!character || !Number.isFinite(starts[index]) || !Number.isFinite(ends[index])) continue
    if (start === null) start = starts[index]
    text += character
    end = ends[index]
    const count = Array.from(text.trim()).length
    if (SENTENCE_END.test(character) || count >= maxCharacters || (count >= maxCharacters - 4 && SOFT_BREAK.test(text))) flush()
  }
  flush()
  return subtitles
}
