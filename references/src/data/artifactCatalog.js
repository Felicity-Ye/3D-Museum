const FACT_FIELDS = [
  'category',
  'period',
  'material',
  'dimensions',
  'findspot',
  'excavationYear',
]

const VECTOR_FIELDS = ['modelPosition', 'modelRotation', 'cameraPosition']

function isVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((number) => Number.isFinite(number))
}

export function mergeArtifactCatalog(manifest, catalog, contentById = {}) {
  const catalogByFile = new Map(catalog.map((artifact) => [artifact.modelFile, artifact]))

  return manifest.map((model) => {
    const record = catalogByFile.get(model.fileName) || {}
    return {
      ...model,
      ...record,
      id: record.id || model.id,
      fileName: model.fileName,
      modelFile: model.fileName,
      modelPath: record.modelPath || model.modelPath,
      category: record.category || '',
      ...Object.fromEntries(FACT_FIELDS.filter((field) => !record[field]).map((field) => [field, ''])),
      thumbnailPath: record.thumbnailPath || '',
      sourceUrl: record.sourceUrl || '',
      keywords: Array.isArray(record.keywords) ? record.keywords : [],
      modelAttribution: record.modelAttribution || 'AI 辅助三维重建，仅供数字展示',
      modelPosition: record.modelPosition || [0, 0, 0],
      modelRotation: record.modelRotation || [0, 0, 0],
      modelScale: record.modelScale || 1,
      cameraPosition: record.cameraPosition || model.cameraPosition || [0, 0.12, 5.2],
      contentPath: record.contentPath || '',
      contentMarkdown: record.id ? contentById[record.id] || '' : '',
    }
  })
}

export function validateArtifactCatalog({ manifest, catalog, contentById = {}, assetExists = () => true }) {
  const errors = []
  const warnings = []
  const ids = new Set()
  const modelFiles = new Set()
  const manifestByFile = new Map(manifest.map((model) => [model.fileName, model]))
  const catalogFileNames = new Set(catalog.map((artifact) => artifact.modelFile))

  for (const model of manifest) {
    if (!catalogFileNames.has(model.fileName)) warnings.push(`GLB 尚未导入文物目录: ${model.fileName}`)
  }

  for (const artifact of catalog) {
    if (!artifact.id) errors.push(`缺少文物 ID: ${artifact.modelFile || '未知 GLB'}`)
    else if (ids.has(artifact.id)) errors.push(`重复 ID: ${artifact.id}`)
    else ids.add(artifact.id)

    if (!artifact.modelFile) errors.push(`缺少 GLB 文件名: ${artifact.id || '未知 ID'}`)
    else if (modelFiles.has(artifact.modelFile)) errors.push(`重复 GLB 文件: ${artifact.modelFile}`)
    else modelFiles.add(artifact.modelFile)

    const model = manifestByFile.get(artifact.modelFile)
    if (!model) errors.push(`本地 GLB 不存在: ${artifact.modelFile}`)
    else if (!artifact.modelPath || artifact.modelPath !== model.modelPath) errors.push(`modelPath 与 GLB 不匹配: ${artifact.modelFile}`)
    if (!artifact.name?.trim()) warnings.push(`文物名称待补充: ${artifact.id || artifact.modelFile}`)
    if (artifact.sourceUrl && !/^https?:\/\//i.test(artifact.sourceUrl)) {
      errors.push(`来源链接格式无效: ${artifact.id}`)
    } else if (!artifact.sourceUrl) warnings.push(`来源链接待补充: ${artifact.id || artifact.modelFile}`)
    if (!Array.isArray(artifact.keywords)) errors.push(`keywords 必须是数组: ${artifact.id}`)
    for (const field of VECTOR_FIELDS) {
      if (artifact[field] !== undefined && !isVector3(artifact[field])) errors.push(`${field} 必须包含三个有限数字: ${artifact.id}`)
    }
    if (artifact.modelScale !== undefined && (!Number.isFinite(artifact.modelScale) || artifact.modelScale <= 0)) {
      errors.push(`modelScale 必须是正数: ${artifact.id}`)
    }
    if (artifact.modelPath && !assetExists(artifact.modelPath)) errors.push(`模型文件不存在: ${artifact.modelPath}`)
    if (artifact.thumbnailPath && !assetExists(artifact.thumbnailPath)) errors.push(`缩略图不存在: ${artifact.thumbnailPath}`)
    if (artifact.contentPath && artifact.id && artifact.contentPath !== `./content/${artifact.id}.md`) {
      errors.push(`Markdown 路径必须使用稳定 ID: ${artifact.id}`)
    }
    if (!artifact.contentPath || !contentById[artifact.id]) warnings.push(`Markdown 资料待补充: ${artifact.id || artifact.modelFile}`)

    for (const field of FACT_FIELDS) {
      if (!artifact[field]) warnings.push(`${field}待补充: ${artifact.id || artifact.modelFile}`)
    }
  }

  return { errors, warnings }
}
