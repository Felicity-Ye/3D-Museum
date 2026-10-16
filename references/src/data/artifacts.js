import { localArtifactManifest } from './artifact-manifest.generated.js'
import { loadArtifactRecords } from './artifactMarkdown.js'

const artifactModules = import.meta.glob('./artifacts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const documents = Object.entries(artifactModules).map(([filePath, rawMarkdown]) => ({ filePath, rawMarkdown }))
const result = loadArtifactRecords(documents, localArtifactManifest)

if (result.errors.length) throw new Error(`Invalid artifact data:\n${result.errors.join('\n')}`)

export const artifacts = result.artifacts
