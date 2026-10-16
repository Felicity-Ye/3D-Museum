import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeArtifactFile } from '../scripts/lib/artifact-file-writer.mjs'

test('new artifact files are created without overwriting existing content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'artifact-write-'))
  const destination = join(directory, 'artifact.md')
  try {
    await writeArtifactFile(destination, 'new content')
    await assert.rejects(writeArtifactFile(destination, 'replacement'), /already exists/)
    assert.equal(await readFile(destination, 'utf8'), 'new content')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('updates are atomic and refuse to replace a document changed since it was read', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'artifact-write-'))
  const destination = join(directory, 'artifact.md')
  try {
    await writeFile(destination, 'original')
    await writeArtifactFile(destination, 'updated', { expectedDocument: 'original' })
    assert.equal(await readFile(destination, 'utf8'), 'updated')
    await writeFile(destination, 'concurrent manual edit')
    await assert.rejects(
      writeArtifactFile(destination, 'stale update', { expectedDocument: 'updated' }),
      /changed since it was read/,
    )
    assert.equal(await readFile(destination, 'utf8'), 'concurrent manual edit')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
