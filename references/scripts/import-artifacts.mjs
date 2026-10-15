import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importArtifactRows, parseArtifactCsv } from './lib/artifact-import.mjs'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = resolve(appDir, '..')
const catalogPath = resolve(appDir, 'src/data/artifacts.json')
const contentDir = resolve(appDir, 'src/data/content')

function getInputPath(args) {
  const index = args.indexOf('--input')
  if (index < 0 || !args[index + 1]) throw new Error('用法: npm run artifacts:import -- --input <csv>')
  return resolve(process.cwd(), args[index + 1])
}

async function run() {
  const inputPath = getInputPath(process.argv.slice(2))
  const [csv, catalogJson, modelFiles, imageFiles, existingContent] = await Promise.all([
    readFile(inputPath, 'utf8'),
    readFile(catalogPath, 'utf8'),
    readdir(resolve(projectDir, 'public/models')),
    readdir(resolve(projectDir, 'public/images/artifacts')).catch(() => []),
    readdir(contentDir).catch(() => []),
  ])
  const rows = parseArtifactCsv(csv)
  const contentFiles = Object.fromEntries(existingContent.filter((file) => file.endsWith('.md')).map((file) => [file.replace(/\.md$/, ''), true]))
  const result = importArtifactRows({
    rows,
    catalog: JSON.parse(catalogJson),
    modelFiles,
    imageFiles,
    contentFiles,
  })

  for (const warning of result.warnings) console.warn(`警告: ${warning}`)
  if (result.errors.length) {
    for (const error of result.errors) console.error(`错误: ${error}`)
    process.exitCode = 1
    return
  }

  await writeFile(catalogPath, `${JSON.stringify(result.catalog, null, 2)}\n`, 'utf8')
  for (const file of result.createdContentFiles) {
    await writeFile(resolve(contentDir, file.fileName), file.markdown, { encoding: 'utf8', flag: 'wx' })
  }
  console.info(`已导入 ${rows.length} 条记录；新增 ${result.createdContentFiles.length} 个 Markdown 模板。`)
}

try {
  await run()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
