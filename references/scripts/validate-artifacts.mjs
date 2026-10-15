import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateArtifactManifest } from './artifact-manifest.mjs'
import { validateArtifactCatalog } from '../src/data/artifactCatalog.js'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = resolve(appDir, '..')
const publicDir = resolve(projectDir, 'public')

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

const [catalogText, modelFiles, contentFiles] = await Promise.all([
  readFile(resolve(appDir, 'src/data/artifacts.json'), 'utf8'),
  readdir(resolve(publicDir, 'models')),
  readdir(resolve(appDir, 'src/data/content')).catch(() => []),
])
const catalog = JSON.parse(catalogText)
const manifest = generateArtifactManifest(modelFiles)
const contentById = Object.fromEntries(await Promise.all(contentFiles.filter((file) => file.endsWith('.md')).map(async (file) => [
  file.replace(/\.md$/, ''),
  await readFile(resolve(appDir, 'src/data/content', file), 'utf8'),
])))
const result = validateArtifactCatalog({ manifest, catalog, contentById, assetExists: publicAssetExists })

for (const error of result.errors) console.error(`错误: ${error}`)
for (const warning of result.warnings) console.warn(`警告: ${warning}`)
if (result.errors.length) process.exitCode = 1
else console.info(`文物目录校验通过：${catalog.length} 条记录，${result.warnings.length} 条资料提醒。`)
