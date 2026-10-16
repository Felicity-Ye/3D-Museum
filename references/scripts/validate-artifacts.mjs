import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateArtifactManifest } from './artifact-manifest.mjs'
import { loadArtifactRecords } from '../src/data/artifactMarkdown.js'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = resolve(appDir, '..')
const publicDir = resolve(projectDir, 'public')
const artifactDir = resolve(appDir, 'src/data/artifacts')

function publicAssetExists(path) {
  if (!path?.startsWith('/')) return false
  let decoded
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return false
  }
  const target = resolve(publicDir, `.${decoded}`)
  const relativePath = relative(publicDir, target)
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return false
  return existsSync(target)
}

const [artifactFiles, modelFiles] = await Promise.all([
  readdir(artifactDir).catch(() => []),
  readdir(resolve(publicDir, 'models')),
])
const documents = await Promise.all(artifactFiles.filter((file) => file.endsWith('.md')).sort().map(async (file) => ({
  filePath: resolve(artifactDir, file),
  rawMarkdown: await readFile(resolve(artifactDir, file), 'utf8'),
})))
const result = loadArtifactRecords(documents, generateArtifactManifest(modelFiles), { assetExists: publicAssetExists })

for (const error of result.errors) console.error(`错误: ${error}`)
for (const warning of result.warnings) console.warn(`待核实: ${warning}`)
if (result.errors.length) process.exitCode = 1
else console.info(`文物 Markdown 校验通过：${documents.length} 条记录，${result.warnings.length} 条待核实信息。`)
