import { useState } from 'react'
import { parseMarkdownBlocks } from './artifactMarkdown.js'

function InlineContent({ tokens, prefix }) {
  return tokens.map((token, index) => {
    const key = `${prefix}-${index}`
    if (token.type === 'strong') return <strong key={key}>{token.value}</strong>
    if (token.type === 'emphasis') return <em key={key}>{token.value}</em>
    if (token.type === 'link') return <a key={key} href={token.href} target="_blank" rel="noreferrer">{token.value}</a>
    return token.value
  })
}

function MarkdownBlocks({ blocks }) {
  return blocks.map((block, index) => {
    const key = `block-${index}`
    if (block.type === 'heading') {
      const Tag = `h${block.level}`
      return <Tag key={key}><InlineContent tokens={block.children} prefix={key} /></Tag>
    }
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul'
      return <Tag key={key}>{block.items.map((tokens, itemIndex) => <li key={`${key}-${itemIndex}`}><InlineContent tokens={tokens} prefix={`${key}-${itemIndex}`} /></li>)}</Tag>
    }
    if (block.type === 'quote') return <blockquote key={key}><InlineContent tokens={block.children} prefix={key} /></blockquote>
    if (block.type === 'rule') return <hr key={key} />
    return <p key={key}><InlineContent tokens={block.children} prefix={key} /></p>
  })
}

export function ArtifactMarkdown({ markdown, className = '', description = false }) {
  const [expanded, setExpanded] = useState(false)
  const blocks = parseMarkdownBlocks(markdown)
  if (!blocks.length) return <p className={`artifact-markdown-empty ${className}`.trim()}>资料待补充</p>
  const isLong = String(markdown).length > 420

  if (description && isLong) {
    return (
      <div className={`artifact-markdown ${className} artifact-description`.trim()}>
        <div className={`artifact-description-scroll${expanded ? ' is-expanded' : ''}`} tabIndex={0} aria-label="文物描述正文">
          <MarkdownBlocks blocks={blocks} />
        </div>
        <button className="artifact-description-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起描述' : '查看全文'}
        </button>
      </div>
    )
  }

  if (isLong) {
    return (
      <details className={`artifact-markdown artifact-markdown-expand ${className}`.trim()}>
        <summary>展开全文</summary>
        <div className="artifact-markdown-body"><MarkdownBlocks blocks={blocks} /></div>
      </details>
    )
  }

  return <div className={`artifact-markdown ${className}`.trim()}><MarkdownBlocks blocks={blocks} /></div>
}
