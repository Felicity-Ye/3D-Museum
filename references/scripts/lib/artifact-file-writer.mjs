import { link, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, basename, join } from 'node:path'

export async function writeArtifactFile(destination, document, { expectedDocument = null } = {}) {
  const temporary = join(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, document, { encoding: 'utf8', flag: 'wx' })
    if (expectedDocument === null) {
      try {
        await link(temporary, destination)
      } catch (error) {
        if (error.code === 'EEXIST') throw new Error(`Artifact destination already exists: ${destination}`)
        throw error
      }
      return
    }

    let current
    try {
      current = await readFile(destination, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Artifact destination changed since it was read: ${destination}`)
      throw error
    }
    if (current !== expectedDocument) throw new Error(`Artifact destination changed since it was read: ${destination}`)
    await rename(temporary, destination)
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}
