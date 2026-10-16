import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localArtifactManifest } from '../src/data/artifact-manifest.generated.js'
import { loadArtifactRecords, parseArtifactDocument } from '../src/data/artifactMarkdown.js'

const metadata = {
  id: 'local-vase',
  name: 'Vase',
  modelFile: 'vase.glb',
  modelPath: '/models/vase.glb',
  category: 'Ceramic',
  period: 'Unknown',
  material: 'Clay',
  dimensions: '',
  thumbnailPath: '/images/vase.png',
  sourceUrl: '',
  sourceVerified: false,
  pendingVerification: ['sourceUrl'],
  keywords: ['vase'],
  modelAttribution: 'Digital display model',
  modelPosition: [0, 0, 0],
  modelRotation: [0, 0, 0],
  modelScale: 1,
  cameraPosition: [0, 0.12, 5.2],
}

const manifest = [{ id: 'local-vase', fileName: 'vase.glb', modelPath: '/models/vase.glb', cameraPosition: [0, 0.12, 5.2] }]
const documentFor = (value = metadata, filePath = 'local-vase.md', body = '\n## 文物描述\n\n正文。\n') => ({
  filePath,
  rawMarkdown: `---\n${JSON.stringify(value, null, 2)}\n---\n${body}`,
})

test('front matter parses as YAML and body is preserved', () => {
  const result = parseArtifactDocument('local-vase.md', '---\nid: local-vase\nkeywords: [vase]\n---\n\n正文。\n')
  assert.deepEqual(result.metadata, { id: 'local-vase', keywords: ['vase'] })
  assert.equal(result.body, '\n正文。\n')
})

test('malformed YAML and non-object front matter report the filename', () => {
  assert.throws(() => parseArtifactDocument('broken.md', '---\nid: [\n---\n'), /broken\.md/)
  assert.throws(() => parseArtifactDocument('scalar.md', '---\n- one\n---\n'), /scalar\.md/)
})

test('duplicate IDs and filename mismatches fail validation', () => {
  const result = loadArtifactRecords([
    documentFor(metadata, 'one.md'),
    documentFor(metadata, 'two.md'),
  ], manifest)
  assert.match(result.errors.join('\n'), /duplicate ID/i)
  assert.match(result.errors.join('\n'), /filename.*ID|ID.*filename/i)
})

test('invalid field types, vectors, scale, sources, and assets fail validation', () => {
  const invalid = {
    ...metadata,
    keywords: 'vase',
    modelPosition: [0, 0],
    modelScale: 0,
    sourceUrl: 'not a url',
    sourceVerified: 'no',
    pendingVerification: 5,
  }
  const result = loadArtifactRecords([documentFor(invalid)], manifest, { assetExists: () => false })
  assert.match(result.errors.join('\n'), /keywords/)
  assert.match(result.errors.join('\n'), /modelPosition/)
  assert.match(result.errors.join('\n'), /modelScale/)
  assert.match(result.errors.join('\n'), /sourceUrl/)
  assert.match(result.errors.join('\n'), /sourceVerified/)
  assert.match(result.errors.join('\n'), /pendingVerification/)
  assert.match(result.errors.join('\n'), /model.*does not exist/i)
  assert.match(result.errors.join('\n'), /thumbnail.*does not exist/i)
})

test('source verification state must agree with its URL and pending marker', () => {
  const result = loadArtifactRecords([documentFor({ ...metadata, sourceUrl: '', sourceVerified: true })], manifest)
  assert.match(result.errors.join('\n'), /sourceVerified cannot be true without sourceUrl/)
  assert.match(result.errors.join('\n'), /verified sourceUrl cannot remain in pendingVerification/)
})

test('source URLs require a parseable HTTP or HTTPS host', () => {
  const result = loadArtifactRecords([documentFor({ ...metadata, sourceUrl: 'https://' })], manifest)
  assert.match(result.errors.join('\n'), /sourceUrl must be a valid HTTP\(S\) URL/)
})

test('normalization preserves frontend data shape and reports missing sources', () => {
  const result = loadArtifactRecords([documentFor({ ...metadata, futureField: { preserved: true } })], manifest)
  assert.equal(result.artifacts[0].id, metadata.id)
  assert.equal(result.artifacts[0].fileName, metadata.modelFile)
  assert.equal(result.artifacts[0].modelPath, metadata.modelPath)
  assert.equal(result.artifacts[0].contentMarkdown, '\n## 文物描述\n\n正文。\n')
  assert.deepEqual(result.artifacts[0].futureField, { preserved: true })
  assert.match(result.warnings.join('\n'), /sourceUrl.*pending/i)
  assert.match(result.warnings.join('\n'), /futureField/)
})

test('current Markdown files load all local GLB artifacts with their existing paths and display settings', async () => {
  const directory = new URL('../src/data/artifacts/', import.meta.url)
  const files = await readdir(directory)
  const documents = await Promise.all(files.filter((file) => file.endsWith('.md')).map(async (file) => ({
    filePath: file,
    rawMarkdown: await readFile(new URL(file, directory), 'utf8'),
  })))
  const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))
  const result = loadArtifactRecords(documents, localArtifactManifest, {
    assetExists: (path) => existsSync(resolve(publicDir, `.${decodeURIComponent(path)}`)),
  })
  assert.deepEqual(result.errors, [])
  assert.equal(result.artifacts.length, 2)
  const head = result.artifacts.find((artifact) => artifact.id === 'local-qingtongrentouxiang')
  const tree = result.artifacts.find((artifact) => artifact.id === 'local-qingtongshenshu')
  assert.equal(head.modelPath, '/models/qingtongrentouxiang.glb')
  assert.equal(head.thumbnailPath, '/images/artifacts/qingtongrentouxiang.png')
  assert.deepEqual(head.modelRotation, [0, 0, 0])
  assert.equal(head.modelScale, 1)
  assert.deepEqual(head.cameraPosition, [0, 0.12, 5.2])
  assert.equal(head.sourceVerified, false)
  assert.ok(head.contentMarkdown.includes('铜人头像为平顶'))
  assert.equal(tree.modelPath, '/models/qingtongshenshu.glb')
  assert.equal(tree.thumbnailPath, '/images/artifacts/qingtongshenshu.png')
  assert.ok(tree.contentMarkdown.includes('大型铜神树'))
})
