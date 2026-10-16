import test from 'node:test'
import assert from 'node:assert/strict'
import { parse } from 'yaml'
import { migrateArtifactRecords } from '../scripts/migrate-artifacts-to-markdown.mjs'

function createIo({ existing = new Map(), contents = new Map() } = {}) {
  const writes = new Map()
  return {
    writes,
    readContent: async (id) => contents.get(id) ?? null,
    readExisting: async (id) => existing.get(id) ?? null,
    writeRecord: async (id, document) => writes.set(id, document),
  }
}

test('migration serializes metadata and preserves the original Markdown body', async () => {
  const record = {
    id: 'jade-vessel', name: '玉器', modelPath: '/models/vase.glb', keywords: ['青玉'],
    category: '类别', period: '年代', material: '材质', dimensions: '尺寸', thumbnailPath: '/images/vase.png',
    contentPath: './content/jade-vessel.md',
  }
  const body = '\n## 文物描述\n\n原始介绍。\n'
  const io = createIo({ contents: new Map([[record.id, body]]) })
  const result = await migrateArtifactRecords({ catalog: [record], ...io, dryRun: false })
  const document = io.writes.get(record.id)
  const [, yaml, migratedBody] = document.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  assert.deepEqual(parse(yaml), {
    ...record,
    contentPath: './artifacts/jade-vessel.md',
    sourceUrl: '',
    sourceVerified: false,
    pendingVerification: ['sourceUrl'],
  })
  assert.equal(migratedBody, body)
  assert.deepEqual(result.created, [record.id])
})

test('dry run plans a file without writing it', async () => {
  const io = createIo()
  const result = await migrateArtifactRecords({ catalog: [{ id: 'vase', name: 'Vase' }], ...io, dryRun: true })
  assert.deepEqual([...io.writes], [])
  assert.deepEqual(result.created, ['vase'])
})

test('blank source stays blank and appears in pending fields', async () => {
  const io = createIo()
  const result = await migrateArtifactRecords({ catalog: [{ id: 'vase', sourceUrl: '' }], ...io, dryRun: false })
  const [, yaml] = io.writes.get('vase').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const metadata = parse(yaml)
  assert.equal(metadata.sourceUrl, '')
  assert.equal(metadata.sourceVerified, false)
  assert.ok(result.pendingFields[0].fields.includes('sourceUrl'))
})

test('missing content is reported and not replaced with generated prose', async () => {
  const io = createIo()
  const result = await migrateArtifactRecords({ catalog: [{ id: 'vase' }], ...io, dryRun: false })
  assert.deepEqual(result.missingContent, ['vase'])
  assert.equal(io.writes.get('vase').endsWith('\n'), true)
  assert.match(io.writes.get('vase'), /contentStatus: pending/)
})

test('existing destinations are skipped and left unchanged on rerun', async () => {
  const oldDocument = 'human-edited data'
  const io = createIo({ existing: new Map([['vase', oldDocument]]) })
  const result = await migrateArtifactRecords({ catalog: [{ id: 'vase' }], ...io, dryRun: false })
  assert.deepEqual(result.skipped, ['vase'])
  assert.deepEqual([...io.writes], [])
})

test('an existing empty destination is also protected from overwrite', async () => {
  const io = createIo({ existing: new Map([['vase', '']]) })
  const result = await migrateArtifactRecords({ catalog: [{ id: 'vase' }], ...io, dryRun: false })
  assert.deepEqual(result.skipped, ['vase'])
  assert.deepEqual([...io.writes], [])
})
