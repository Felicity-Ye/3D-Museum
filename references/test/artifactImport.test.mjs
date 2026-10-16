import test from 'node:test'
import assert from 'node:assert/strict'
import { importArtifactRows } from '../scripts/lib/artifact-import.mjs'

test('CSV import creates a pending Markdown record without generated factual prose', () => {
  const result = importArtifactRows({
    rows: [{ modelFile: 'vase.glb', name: 'Vase' }],
    catalog: [],
    modelFiles: ['vase.glb'],
    imageFiles: [],
    contentFiles: [],
  })
  assert.deepEqual(result.errors, [])
  assert.equal(result.catalog[0].contentPath, './artifacts/local-vase.md')
  assert.equal(result.catalog[0].sourceVerified, false)
  assert.equal(result.catalog[0].contentStatus, 'pending')
  assert.equal(result.createdContentFiles[0].markdown, '')
})

test('changing a source URL resets its verification state', () => {
  const result = importArtifactRows({
    rows: [{ modelFile: 'vase.glb', name: 'Vase', sourceUrl: 'https://new.example/source' }],
    catalog: [{ id: 'local-vase', modelFile: 'vase.glb', name: 'Vase', sourceUrl: 'https://old.example/source', sourceVerified: true }],
    modelFiles: ['vase.glb'],
    imageFiles: [],
    contentFiles: ['local-vase'],
  })
  assert.equal(result.catalog[0].sourceUrl, 'https://new.example/source')
  assert.equal(result.catalog[0].sourceVerified, false)
})
