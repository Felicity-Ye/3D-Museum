import { readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(scriptDir, '..')
const modelDir = resolve(appDir, '..', 'public', 'models')
const outputPath = join(appDir, 'src', 'data', 'artifact-manifest.generated.js')

export function generateArtifactManifest(fileNames) {
  return fileNames
    .filter((fileName) => /\.glb$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((fileName) => ({
      id: `local-${basename(fileName, fileName.slice(fileName.lastIndexOf('.'))).toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      fileName,
      modelPath: `/models/${encodeURIComponent(fileName)}`,
      cameraPosition: [0, 0.12, 5.2],
    }))
}

export async function writeArtifactManifest() {
  const names = await readdir(modelDir)
  const manifest = generateArtifactManifest(names)
  await writeFile(outputPath, `// Generated from public/models. Add artifact metadata and content in src/data/artifacts/<id>.md.\nexport const localArtifactManifest = ${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await writeArtifactManifest()
  console.info(`Generated artifact manifest for ${manifest.length} local GLB file(s).`)
}
