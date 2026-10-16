import { access } from 'node:fs/promises'
import test from 'node:test'
import { resolve } from 'node:path'
import { getArtifactTour } from '../src/data/artifactTours.js'
import viteConfig from '../vite.config.js'

test('configured tour audio URLs resolve from Vite public directory', async () => {
  const chapters = getArtifactTour('local-qingtongshenshu')
  for (const chapter of chapters) {
    await access(resolve(viteConfig.publicDir, chapter.audioUrl.slice(1)))
    await access(resolve(viteConfig.publicDir, chapter.subtitlesUrl.slice(1)))
  }
})
