import catalog from './artifacts.json'
import { localArtifactManifest } from './artifact-manifest.generated.js'
import { mergeArtifactCatalog } from './artifactCatalog.js'

const contentModules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const contentById = Object.fromEntries(Object.entries(contentModules).map(([path, markdown]) => [
  path.split('/').at(-1).replace(/\.md$/, ''),
  markdown,
]))

export const artifacts = mergeArtifactCatalog(localArtifactManifest, catalog, contentById)
