const SECTION_KEYS = new Map([
  ['文物描述', 'description'],
  ['描述', 'description'],
])
const HIDDEN_SECTION_TITLES = new Set(['文化价值', '历史文化价值'])

export function parseArtifactMarkdown(markdown) {
  const source = String(markdown || '').trim()
  if (!source) return []
  const sections = []
  let current = null
  let extraIndex = 0
  let skippingHiddenSection = false

  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*#*\s*$/)
    if (heading) {
      if (current) sections.push({ ...current, markdown: current.lines.join('\n').trim() })
      const title = heading[1].trim()
      if (HIDDEN_SECTION_TITLES.has(title)) {
        current = null
        skippingHiddenSection = true
        continue
      }
      skippingHiddenSection = false
      current = {
        key: SECTION_KEYS.get(title) || `additional-${++extraIndex}`,
        title,
        lines: [],
      }
    } else if (!skippingHiddenSection) {
      if (!current) current = { key: `additional-${++extraIndex}`, title: '补充内容', lines: [] }
      current.lines.push(line)
    }
  }
  if (current) sections.push({ ...current, markdown: current.lines.join('\n').trim() })
  return sections.filter((section) => section.markdown)
}

function parseInlineMarkdown(text) {
  const tokens = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    if (index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, index) })
    if (match[1]) {
      tokens.push({ type: 'strong', value: match[1] })
    } else if (match[2]) {
      tokens.push({ type: 'emphasis', value: match[2] })
    } else {
      const safeUrl = isHttpsUrl(match[4])
      tokens.push(safeUrl
        ? { type: 'link', value: match[3], href: match[4] }
        : { type: 'text', value: match[0] })
    }
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) })
  return tokens
}

function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function parseMarkdownBlocks(markdown) {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInlineMarkdown(heading[2]) })
      index += 1
      continue
    }
    if (/^(---+|\*\*\*+|___+)$/.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', children: parseInlineMarkdown(quote.join(' ')) })
      continue
    }
    const listMatch = line.match(/^([-*+]\s+|\d+[.)]\s+)(.+)$/)
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1])
      const items = []
      while (index < lines.length) {
        let itemIndex = index
        while (itemIndex < lines.length && !lines[itemIndex].trim()) itemIndex += 1
        const item = lines[itemIndex]?.trim().match(/^([-*+]\s+|\d+[.)]\s+)(.+)$/)
        if (!item || ordered !== /^\d/.test(item[1])) break
        items.push(parseInlineMarkdown(item[2]))
        index = itemIndex + 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+|---+$|\*\*\*+$|___+$)/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', children: parseInlineMarkdown(paragraph.join(' ')) })
  }

  return blocks
}
