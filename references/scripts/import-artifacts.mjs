import { mkdir, readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { parseArtifactDocument } from '../src/data/artifactMarkdown.js'
import { importArtifactRows, parseArtifactCsv } from './lib/artifact-import.mjs'
import { writeArtifactFile } from './lib/artifact-file-writer.mjs'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = resolve(appDir, '..')
const artifactDir = resolve(appDir, 'src/data/artifacts')

function getInputPath(args) {
  const index = args.indexOf('--input')
  if (index < 0 || !args[index + 1]) throw new Error('Usage: npm run artifacts:import -- --input <csv>')
  return resolve(process.cwd(), args[index + 1])
}

async function run() {
  const inputPath = getInputPath(process.argv.slice(2))
  const [csv, modelFiles, imageFiles, artifactFiles] = await Promise.all([
    readFile(inputPath, 'utf8'),
    readdir(resolve(projectDir, 'public/models')),
    readdir(resolve(projectDir, 'public/images/artifacts')).catch(() => []),
    readdir(artifactDir).catch(() => []),
  ])
  const existingDocuments = await Promise.all(artifactFiles.filter((file) => file.endsWith('.md')).map(async (file) => {
    const rawMarkdown = await readFile(resolve(artifactDir, file), 'utf8')
    return { fileName: file, rawMarkdown, ...parseArtifactDocument(file, rawMarkdown) }
  }))
  const catalog = existingDocuments.map(({ metadata }) => metadata)
  const contentById = new Map(existingDocuments.map(({ fileName, body }) => [fileName.replace(/\.md$/, ''), body]))
  const rawById = new Map(existingDocuments.map(({ fileName, rawMarkdown }) => [fileName.replace(/\.md$/, ''), rawMarkdown]))
  const rows = parseArtifactCsv(csv)
  const result = importArtifactRows({
    rows,
    catalog,
    modelFiles,
    imageFiles,
    contentFiles: new Set(contentById.keys()),
  })

  for (const warning of result.warnings) console.warn(`Warning: ${warning}`)
  if (result.errors.length) {
    for (const error of result.errors) console.error(`Error: ${error}`)
    process.exitCode = 1
    return
  }

  await mkdir(artifactDir, { recursive: true })
  const importedModelFiles = new Set(rows.map((row) => row.modelFile?.trim()).filter(Boolean))
  for (const record of result.catalog.filter((entry) => importedModelFiles.has(entry.modelFile))) {
    const body = contentById.get(record.id) ?? ''
    const metadata = { ...record, contentPath: `./artifacts/${record.id}.md` }
    if (!body.trim()) metadata.contentStatus = 'pending'
    await writeArtifactFile(resolve(artifactDir, `${record.id}.md`), `---\n${stringify(metadata).trimEnd()}\n---\n${body}`, {
      expectedDocument: rawById.has(record.id) ? rawById.get(record.id) : null,
    })
  }
  console.info(`Imported ${rows.length} row(s); created ${result.createdContentFiles.length} pending Markdown record(s).`)
}

run().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
