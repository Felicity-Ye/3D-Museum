import { basename, extname } from 'node:path'
import { createHash } from 'node:crypto'

const OPTIONAL_FIELDS = ['category', 'period', 'material', 'dimensions', 'findspot', 'excavationYear', 'modelAttribution']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']

function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === ',') {
      row.push(field.trim())
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (quoted) throw new Error('CSV 中存在未闭合的引号')
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

export function parseArtifactCsv(text) {
  const [headerRow, ...dataRows] = parseCsvRows(text.replace(/^\uFEFF/, ''))
  if (!headerRow) return []
  const headers = headerRow.map((header) => header.trim())
  const required = ['modelFile', 'name']
  const missing = required.filter((field) => !headers.includes(field))
  if (missing.length) throw new Error(`CSV 缺少必需列: ${missing.join(', ')}`)

  return dataRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])))
    .filter((row) => row.modelFile || row.name)
}

function stableId(modelFile) {
  const base = basename(modelFile, extname(modelFile)).toLocaleLowerCase()
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug ? `local-${slug}` : `local-model-${createHash('sha1').update(modelFile).digest('hex').slice(0, 8)}`
}

function makeMarkdown(sourceUrl) {
  return [
    '## 文物描述', '', '资料待补充', '',
    '## 文化价值', '', '资料待补充', '',
  ].join('\n')
}

function asSet(values) {
  return values instanceof Set ? values : new Set(values || [])
}

function contentExists(contentFiles, id) {
  if (contentFiles instanceof Set) return contentFiles.has(id) || contentFiles.has(`${id}.md`)
  if (contentFiles instanceof Map) return contentFiles.has(id) || contentFiles.has(`${id}.md`)
  return Boolean(contentFiles?.[id] || contentFiles?.[`${id}.md`])
}

function parseOptionalNumber(value, field, errors, id) {
  if (value === undefined || value === '') return undefined
  const number = Number(value)
  if (!Number.isFinite(number)) {
    errors.push(`字段 ${field} 不是有效数字: ${id}`)
    return undefined
  }
  return number
}

export function importArtifactRows({ rows, catalog, modelFiles, imageFiles, contentFiles }) {
  const errors = []
  const warnings = []
  const modelFileSet = asSet(modelFiles)
  const imageFileSet = asSet(imageFiles)
  const records = new Map(catalog.map((artifact) => [artifact.modelFile, { ...artifact }]))
  const ids = new Map(catalog.map((artifact) => [artifact.id, artifact.modelFile]))
  const seenRows = new Set()
  const createdContentFiles = []

  for (const row of rows) {
    const modelFile = row.modelFile?.trim()
    const name = row.name?.trim()
    if (!modelFile) {
      errors.push('导入行缺少 GLB 文件名')
      continue
    }
    if (seenRows.has(modelFile)) {
      errors.push(`CSV 中重复 GLB: ${modelFile}`)
      continue
    }
    seenRows.add(modelFile)
    if (!modelFileSet.has(modelFile)) {
      errors.push(`本地 GLB 不存在: ${modelFile}`)
      continue
    }
    if (!name && !records.has(modelFile)) {
      errors.push(`新文物缺少名称: ${modelFile}`)
      continue
    }
    const sourceUrl = row.sourceUrl?.trim() || ''
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      errors.push(`来源链接格式无效: ${modelFile}`)
      continue
    }

    const existing = records.get(modelFile)
    const id = existing?.id || stableId(modelFile)
    const idOwner = ids.get(id)
    if (idOwner && idOwner !== modelFile) {
      errors.push(`ID 冲突 ${id}: ${idOwner} / ${modelFile}`)
      continue
    }
    ids.set(id, modelFile)

    const base = basename(modelFile, extname(modelFile))
    const suggestedThumbnail = row.thumbnailFile?.trim() || IMAGE_EXTENSIONS.map((extension) => `${base}${extension}`).find((file) => imageFileSet.has(file)) || ''
    if (suggestedThumbnail && !imageFileSet.has(suggestedThumbnail)) {
      errors.push(`缩略图不存在: ${suggestedThumbnail}`)
      continue
    }

    const next = {
      ...(existing || {}),
      id,
      modelFile,
      modelPath: `/models/${encodeURIComponent(modelFile)}`,
      name: name || existing?.name || '',
      sourceUrl: sourceUrl || existing?.sourceUrl || '',
      thumbnailPath: suggestedThumbnail ? `/images/artifacts/${encodeURIComponent(suggestedThumbnail)}` : existing?.thumbnailPath || '',
      contentPath: existing?.contentPath || `./content/${id}.md`,
      keywords: existing?.keywords || [],
      modelAttribution: row.modelAttribution?.trim() || existing?.modelAttribution || 'AI 辅助三维重建，仅供数字展示',
      modelPosition: existing?.modelPosition || [0, 0, 0],
      modelRotation: existing?.modelRotation || [0, 0, 0],
      modelScale: existing?.modelScale || 1,
      cameraPosition: existing?.cameraPosition || [0, 0.12, 5.2],
    }

    for (const field of OPTIONAL_FIELDS.filter((key) => key !== 'modelAttribution')) {
      next[field] = row[field]?.trim() || existing?.[field] || ''
    }
    if (row.keywords?.trim()) {
      next.keywords = row.keywords.split(/[|;；、]/).map((keyword) => keyword.trim()).filter(Boolean)
    }
    const scale = parseOptionalNumber(row.modelScale, 'modelScale', errors, id)
    if (scale !== undefined) next.modelScale = scale
    records.set(modelFile, next)

    if (!contentExists(contentFiles, id) && !createdContentFiles.some((entry) => entry.id === id)) {
      createdContentFiles.push({ id, fileName: `${id}.md`, markdown: makeMarkdown(next.sourceUrl) })
    }
    if (!next.sourceUrl) warnings.push(`来源链接待补充: ${id}`)
    if (!next.thumbnailPath) warnings.push(`缩略图待补充: ${id}`)
  }

  return { catalog: [...records.values()], createdContentFiles, errors, warnings }
}
