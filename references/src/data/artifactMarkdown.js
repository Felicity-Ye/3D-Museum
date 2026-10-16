import { parseDocument as parseYamlDocument } from 'yaml'

const VECTOR_FIELDS = ['modelPosition', 'modelRotation', 'cameraPosition']
const STRING_FIELDS = [
  'modelFile', 'modelPath', 'name', 'category', 'period', 'material', 'dimensions', 'findspot', 'excavationYear',
  'thumbnailPath', 'sourceUrl', 'modelAttribution', 'contentPath', 'contentStatus',
]
const KNOWN_FIELDS = new Set([
  'id', ...STRING_FIELDS, 'keywords', 'sourceVerified', 'pendingVerification', 'modelPosition', 'modelRotation',
  'modelScale', 'cameraPosition',
])

export function parseArtifactDocument(filePath, rawMarkdown) {
  const match = String(rawMarkdown).match(/^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/)
  if (!match) throw new Error(`${filePath}: missing YAML front matter delimiters`)

  const yamlDocument = parseYamlDocument(match[1], { uniqueKeys: true })
  if (yamlDocument.errors.length) {
    throw new Error(`${filePath}: invalid YAML front matter: ${yamlDocument.errors.map((error) => error.message).join('; ')}`)
  }
  const metadata = yamlDocument.toJS()
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`${filePath}: YAML front matter must be a mapping`)
  }
  return { metadata, body: match[2] }
}

function isVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((number) => Number.isFinite(number))
}

function isLocalPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[?#]/.test(value)
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function loadArtifactRecords(documents, manifest, { assetExists = () => true } = {}) {
  const errors = []
  const warnings = []
  const parsed = []
  const ids = new Set()
  const modelFiles = new Set()
  const manifestByFile = new Map()

  for (const model of manifest) {
    if (manifestByFile.has(model.fileName)) errors.push(`Duplicate GLB model file: ${model.fileName}`)
    manifestByFile.set(model.fileName, model)
  }

  for (const document of documents) {
    const filePath = document.filePath || '(unknown artifact document)'
    let metadata
    let body
    try {
      ({ metadata, body } = parseArtifactDocument(filePath, document.rawMarkdown))
    } catch (error) {
      errors.push(error.message)
      continue
    }

    const id = metadata.id
    const pendingFields = Array.isArray(metadata.pendingVerification) ? metadata.pendingVerification : []
    const fileName = filePath.replaceAll('\\', '/').split('/').at(-1)
    if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      errors.push(`${filePath}: missing or invalid stable ID`)
    } else {
      if (ids.has(id)) errors.push(`Duplicate ID: ${id}`)
      ids.add(id)
      if (fileName !== `${id}.md`) errors.push(`${filePath}: filename must match ID ${id}.md`)
    }

    for (const key of Object.keys(metadata)) {
      if (!KNOWN_FIELDS.has(key)) warnings.push(`${id || filePath}: unknown metadata field preserved: ${key}`)
    }
    for (const field of ['name', 'modelFile', 'modelPath', 'thumbnailPath', 'sourceUrl', 'sourceVerified', 'keywords', 'modelPosition', 'modelRotation', 'modelScale', 'cameraPosition']) {
      if (!Object.hasOwn(metadata, field)) errors.push(`${id || filePath}: missing required field ${field}`)
    }
    for (const field of STRING_FIELDS) {
      if (Object.hasOwn(metadata, field) && typeof metadata[field] !== 'string') {
        errors.push(`${id || filePath}: ${field} must be a string`)
      }
    }
    if (typeof metadata.name === 'string' && !metadata.name.trim()) errors.push(`${id || filePath}: name must not be blank`)
    if (typeof metadata.modelFile === 'string') {
      if (modelFiles.has(metadata.modelFile)) errors.push(`Duplicate modelFile: ${metadata.modelFile}`)
      modelFiles.add(metadata.modelFile)
      if (!/^[^/\\]+\.glb$/i.test(metadata.modelFile)) errors.push(`${id || filePath}: modelFile must be a GLB filename`)
    }
    if (metadata.modelPath && !isLocalPath(metadata.modelPath)) errors.push(`${id || filePath}: modelPath must be a local absolute asset path`)
    if (metadata.thumbnailPath && !isLocalPath(metadata.thumbnailPath)) errors.push(`${id || filePath}: thumbnailPath must be a local absolute asset path`)
    if (metadata.modelPath && !assetExists(metadata.modelPath)) errors.push(`${id || filePath}: model asset does not exist: ${metadata.modelPath}`)
    if (metadata.thumbnailPath && !assetExists(metadata.thumbnailPath)) errors.push(`${id || filePath}: thumbnail asset does not exist: ${metadata.thumbnailPath}`)
    for (const field of VECTOR_FIELDS) {
      if (Object.hasOwn(metadata, field) && !isVector3(metadata[field])) errors.push(`${id || filePath}: ${field} must contain exactly three finite numbers`)
    }
    if (Object.hasOwn(metadata, 'modelScale') && (!Number.isFinite(metadata.modelScale) || metadata.modelScale <= 0)) {
      errors.push(`${id || filePath}: modelScale must be a positive finite number`)
    }
    if (Object.hasOwn(metadata, 'keywords') && (!Array.isArray(metadata.keywords) || !metadata.keywords.every((keyword) => typeof keyword === 'string'))) {
      errors.push(`${id || filePath}: keywords must be an array of strings`)
    }
    if (Object.hasOwn(metadata, 'sourceVerified') && typeof metadata.sourceVerified !== 'boolean') {
      errors.push(`${id || filePath}: sourceVerified must be a boolean`)
    }
    if (Object.hasOwn(metadata, 'pendingVerification') && (!Array.isArray(metadata.pendingVerification) || !metadata.pendingVerification.every((field) => typeof field === 'string'))) {
      errors.push(`${id || filePath}: pendingVerification must be an array of strings`)
    }
    for (const field of pendingFields) warnings.push(`${id || filePath}: ${field} pending verification`)
    if (typeof metadata.sourceUrl === 'string' && metadata.sourceUrl) {
      if (!isHttpUrl(metadata.sourceUrl)) errors.push(`${id || filePath}: sourceUrl must be a valid HTTP(S) URL`)
      else if (metadata.sourceVerified === false && !pendingFields.includes('sourceUrl')) warnings.push(`${id || filePath}: sourceUrl pending verification`)
    } else if (!pendingFields.includes('sourceUrl')) {
      warnings.push(`${id || filePath}: sourceUrl pending verification`)
    }
    if (metadata.sourceVerified === true && !metadata.sourceUrl) errors.push(`${id || filePath}: sourceVerified cannot be true without sourceUrl`)
    if (metadata.sourceVerified === false && !pendingFields.includes('sourceUrl')) {
      errors.push(`${id || filePath}: unverified sourceUrl must be listed in pendingVerification`)
    }
    if (metadata.sourceVerified === true && pendingFields.includes('sourceUrl')) {
      errors.push(`${id || filePath}: verified sourceUrl cannot remain in pendingVerification`)
    }
    if (!body.trim()) {
      warnings.push(`${id || filePath}: content pending`)
      if (metadata.contentStatus !== 'pending') errors.push(`${id || filePath}: empty content must set contentStatus: pending`)
    }
    if (metadata.contentStatus && metadata.contentStatus !== 'pending') errors.push(`${id || filePath}: contentStatus must be pending when present`)

    const model = manifestByFile.get(metadata.modelFile)
    if (!model) errors.push(`${id || filePath}: GLB modelFile is not in the local manifest: ${metadata.modelFile || ''}`)
    else if (metadata.modelPath !== model.modelPath) errors.push(`${id || filePath}: modelPath does not match the GLB manifest path`)
    if (typeof metadata.category !== 'string' || !metadata.category.trim()) warnings.push(`${id || filePath}: category pending verification`)
    if (!metadata.thumbnailPath && !pendingFields.includes('thumbnailPath')) warnings.push(`${id || filePath}: thumbnailPath pending verification`)
    for (const field of ['period', 'material', 'dimensions']) {
      if (typeof metadata[field] !== 'string' || !metadata[field].trim()) warnings.push(`${id || filePath}: ${field} pending verification`)
    }
    parsed.push({ metadata, body, model })
  }

  const recordsByFile = new Map(parsed.filter(({ metadata }) => metadata.modelFile).map((entry) => [entry.metadata.modelFile, entry]))
  const artifacts = []
  for (const model of manifest) {
    const entry = recordsByFile.get(model.fileName)
    if (entry) {
      artifacts.push({
        ...model,
        ...entry.metadata,
        fileName: model.fileName,
        contentMarkdown: entry.body,
      })
    } else {
      warnings.push(`GLB has no artifact Markdown record: ${model.fileName}`)
      artifacts.push({
        ...model,
        fileName: model.fileName,
        modelFile: model.fileName,
        modelPath: model.modelPath,
        category: '',
        period: '',
        material: '',
        dimensions: '',
        thumbnailPath: '',
        sourceUrl: '',
        keywords: [],
        modelAttribution: '',
        modelPosition: [0, 0, 0],
        modelRotation: [0, 0, 0],
        modelScale: 1,
        cameraPosition: model.cameraPosition || [0, 0.12, 5.2],
        contentMarkdown: '',
      })
    }
  }
  for (const entry of parsed) {
    if (!entry.model) artifacts.push({ ...entry.metadata, fileName: entry.metadata.modelFile, contentMarkdown: entry.body })
  }

  return { artifacts, errors, warnings }
}
