const SENTENCE_END = /[。！？!?；;]/u
const SOFT_BREAK = /[，,：:]$/u

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
