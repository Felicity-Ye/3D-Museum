import { mkdir, readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { stringify } from 'yaml'
import { writeArtifactFile } from './lib/artifact-file-writer.mjs'

const REVIEW_FIELDS = ['name', 'category', 'period', 'material', 'dimensions', 'thumbnailPath', 'sourceUrl']

export async function migrateArtifactRecords({ catalog, readContent, readExisting, writeRecord, dryRun = true }) {
  const result = { created: [], skipped: [], missingContent: [], pendingFields: [] }

  for (const record of catalog) {
    if (!record || typeof record.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id)) {
      throw new Error(`Invalid stable artifact ID: ${record?.id ?? '(missing)'}`)
    }

    const existing = await readExisting(record.id)
    if (existing !== null && existing !== undefined && existing !== false) {
      result.skipped.push(record.id)
      continue
    }

    const metadata = structuredClone(record)
    if (Object.hasOwn(metadata, 'contentPath')) metadata.contentPath = `./artifacts/${record.id}.md`
    if (!Object.hasOwn(metadata, 'sourceUrl')) metadata.sourceUrl = ''
    metadata.sourceVerified ??= false
    const pending = new Set(Array.isArray(metadata.pendingVerification) ? metadata.pendingVerification : [])
    for (const field of REVIEW_FIELDS) {
      if (typeof metadata[field] !== 'string' || !metadata[field].trim()) pending.add(field)
    }
    if (metadata.sourceVerified === false) pending.add('sourceUrl')
    metadata.pendingVerification = [...pending]
    if (pending.size) result.pendingFields.push({ id: record.id, fields: [...pending] })

    const body = await readContent(record.id)
    const contentMissing = typeof body !== 'string' || !body.trim()
    if (contentMissing) {
      result.missingContent.push(record.id)
      metadata.contentStatus = 'pending'
    }

    const document = `---\n${stringify(metadata).trimEnd()}\n---\n${body ?? ''}`
    if (!dryRun) await writeRecord(record.id, document)
    result.created.push(record.id)
  }

  return result
}

async function runCli() {
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dataDir = resolve(appDir, 'src/data')
  let catalogText
  try {
    catalogText = await readFile(resolve(dataDir, 'artifacts.json'), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Legacy artifacts.json is not present; this one-time migration is only for pre-Markdown data.')
    throw error
  }
  const catalog = JSON.parse(catalogText)
  const contents = new Set((await readdir(resolve(dataDir, 'content')).catch(() => [])).filter((file) => file.endsWith('.md')))
  const destinations = new Set((await readdir(resolve(dataDir, 'artifacts')).catch(() => [])).filter((file) => file.endsWith('.md')))
  const write = process.argv.includes('--write')

  if (write) await mkdir(resolve(dataDir, 'artifacts'), { recursive: true })

  const result = await migrateArtifactRecords({
    catalog,
    readContent: async (id) => contents.has(`${id}.md`) ? readFile(resolve(dataDir, 'content', `${id}.md`), 'utf8') : null,
    readExisting: async (id) => destinations.has(`${id}.md`),
    writeRecord: async (id, document) => writeArtifactFile(resolve(dataDir, 'artifacts', `${id}.md`), document),
    dryRun: !write,
  })

  console.info(`${write ? 'Migration' : 'Dry run'}: ${result.created.length} to create, ${result.skipped.length} skipped, ${result.missingContent.length} missing content.`)
  for (const id of result.created) console.info(`  ${write ? 'created' : 'would create'}: ${id}`)
  for (const id of result.skipped) console.info(`  skipped existing destination: ${id}`)
  for (const { id, fields } of result.pendingFields) console.warn(`  pending verification: ${id}: ${fields.join(', ')}`)
  for (const id of result.missingContent) console.warn(`  missing content: ${id}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
