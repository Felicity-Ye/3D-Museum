import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { getArtifactTour } from '../src/data/artifactTours.js'
import { groupTimedSubtitles, parseSrtSubtitles, restoreSubtitlePunctuation, speedToEdgeRate } from './tour-audio-utils.mjs'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = resolve(appDir, 'src/data/artifact-tours.json')
const publicDir = resolve(appDir, '../public')
const execFileAsync = promisify(execFile)

function parseArgs(args) {
  const options = { artifact: 'local-qingtongshenshu', chapter: null, voice: process.env.EDGE_TTS_VOICE || 'zh-CN-XiaoxiaoNeural', speed: Number(process.env.EDGE_TTS_SPEED || 0.92), force: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const [key, inlineValue] = arg.split('=', 2)
    const readValue = () => inlineValue ?? args[++index]
    if (key === '--artifact') options.artifact = readValue()
    else if (key === '--chapter') options.chapter = readValue()
    else if (key === '--voice') options.voice = readValue()
    else if (key === '--speed') options.speed = Number(readValue())
    else if (key === '--force') options.force = true
    else if (key === '--help' || key === '-h') options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

async function loadLocalEnvironment() {
  for (const file of ['.env.local', '.env']) {
    let contents
    try { contents = await readFile(resolve(appDir, file), 'utf8') } catch { continue }
    for (const line of contents.split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u)
      if (!match || process.env[match[1]] !== undefined) continue
      const value = match[2].replace(/^(['"])(.*)\1$/u, '$2')
      process.env[match[1]] = value
    }
  }
}

function getText(chapter) {
  const text = chapter.narration?.trim()
  if (!text) throw new Error(`${chapter.id}: empty narration; add reviewed narration before generating audio`)
  return text
}

export async function generateTourAudio(providedOptions) {
  await loadLocalEnvironment()
  const options = providedOptions || parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write('Usage: npm run audio:generate -- [--artifact ID] [--chapter ID] [--voice zh-CN-XiaoxiaoNeural] [--speed 0.92] [--force]\n')
    return
  }
  if (!Number.isFinite(options.speed) || options.speed < 0.7 || options.speed > 1.2) throw new Error('--speed must be between 0.7 and 1.2')

  const rawConfig = JSON.parse(await readFile(configPath, 'utf8'))
  const chapters = getArtifactTour(options.artifact)
  if (!chapters) throw new Error(`No valid tour configured for artifact ${options.artifact}`)
  const selected = options.chapter ? chapters.filter((chapter) => chapter.id === options.chapter) : chapters
  if (options.chapter && !selected.length) throw new Error(`Unknown chapter ${options.chapter} for ${options.artifact}`)

  for (const chapter of selected) {
    const text = getText(chapter)
    const outputDir = resolve(publicDir, 'audio', options.artifact)
    const mp3File = resolve(outputDir, `${chapter.id}.mp3`)
    const alignmentFile = resolve(outputDir, `${chapter.id}.alignment.srt`)
    const subtitlesFile = resolve(outputDir, `${chapter.id}.subtitles.json`)
    await mkdir(outputDir, { recursive: true })
    const filesExist = await Promise.all([mp3File, alignmentFile, subtitlesFile].map(async (file) => {
      try { await readFile(file); return true } catch { return false }
    }))
    if (filesExist[0] && !options.force) {
      if (filesExist[1] && !filesExist[2]) {
        const savedAlignment = JSON.parse(await readFile(alignmentFile, 'utf8'))
        const subtitles = groupCharacterAlignment(savedAlignment.alignment)
        if (subtitles.length) await writeFile(subtitlesFile, `${JSON.stringify(subtitles, null, 2)}\n`)
      }
      process.stdout.write(`Skip ${chapter.id}: MP3 already exists; no TTS request made${filesExist[1] || filesExist[2] ? '.' : ', but alignment/subtitles are missing.'}\n`)
    } else {
      const python = process.env.PYTHON || 'python'
      const mp3Temp = `${mp3File}.tmp.mp3`
      const alignmentTemp = `${alignmentFile}.tmp`
      const subtitlesTemp = `${subtitlesFile}.tmp`
      try {
        await execFileAsync(python, [
          resolve(appDir, 'scripts/edge_tts_generate.py'), '--voice', options.voice, `--rate=${speedToEdgeRate(options.speed)}`,
          '--text', text, '--media', mp3Temp, '--subtitles', alignmentTemp,
        ], { windowsHide: true, maxBuffer: 1024 * 1024 })
      } catch (error) {
        const detail = String(error.stderr || error.message || '').trim()
        if (detail.includes("No module named edge_tts") || error.code === 'ENOENT') {
          throw new Error('Install the audio generator with "python -m pip install -r requirements-audio.txt" before generating audio.')
        }
        throw new Error(`Edge TTS failed for ${chapter.id}: ${detail}`)
      }
      const srt = await readFile(alignmentTemp, 'utf8')
      const wordCues = restoreSubtitlePunctuation(parseSrtSubtitles(srt), text)
      const subtitles = groupTimedSubtitles(wordCues)
      if (!subtitles.length) throw new Error(`TTS response for ${chapter.id} produced no timed subtitles`)
      await Promise.all([
        writeFile(subtitlesTemp, `${JSON.stringify(subtitles, null, 2)}\n`),
      ])
      await Promise.all([[mp3Temp, mp3File], [alignmentTemp, alignmentFile], [subtitlesTemp, subtitlesFile]].map(([from, to]) => rename(from, to)))
      process.stdout.write(`Generated ${chapter.id}: ${subtitles.length} timed subtitles.\n`)
    }

    const chapterIndex = chapters.findIndex((item) => item.id === chapter.id)
    const timingFileExists = await readFile(subtitlesFile).then(() => true, () => false)
    rawConfig[options.artifact][chapterIndex] = {
      ...rawConfig[options.artifact][chapterIndex],
      audioUrl: `/audio/${options.artifact}/${chapter.id}.mp3`,
      subtitlesUrl: timingFileExists ? `/audio/${options.artifact}/${chapter.id}.subtitles.json` : null,
    }
  }
  const configTemp = `${configPath}.tmp`
  await writeFile(configTemp, `${JSON.stringify(rawConfig, null, 2)}\n`)
  await rename(configTemp, configPath)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateTourAudio().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
