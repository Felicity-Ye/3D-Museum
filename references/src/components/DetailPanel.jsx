import { Bookmark, Heart, Info, Sparkles, Tags } from 'lucide-react'

import { getCell } from '../domain/cellCatalog.js'
import { getAssetMetadata } from '../lib/assetMetadata.js'

export function DetailPanel({ selectedCell, favoriteKey, setFavoriteKey, customCells, onNotify }) {
  const cell = getCell(selectedCell, customCells)
  const metadata = getAssetMetadata(cell)
  const currentKey = `${selectedCell}:asset`
  const isFavorite = favoriteKey === currentKey

  function toggleFavorite() {
    const next = isFavorite ? '' : currentKey
    setFavoriteKey(next)
    onNotify(isFavorite ? `${metadata.title} removed from favorites` : `${metadata.title} saved to favorites`)
  }

  return (
    <aside className="right-rail">
      <section className="panel detail-panel">
        <header className="detail-title">
          <span>
            <Info size={14} />
            Asset Details
          </span>
          <button type="button" className={isFavorite ? 'detail-fav active' : 'detail-fav'} onClick={toggleFavorite} aria-pressed={isFavorite}>
            <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </header>
        <div className="detail-heading asset-heading">
          <div className="cluster-icon asset-icon" style={{ '--cluster': metadata.accent }}>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <h2>{metadata.title}</h2>
            <p>{metadata.subtitle}</p>
          </div>
        </div>
        <dl className="detail-grid">
          {metadata.facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel notes-panel">
        <header className="panel-title">
          <span>
            <Bookmark size={14} />
            Object Description
          </span>
        </header>
        <p>{metadata.description}</p>
        <blockquote>{metadata.value}</blockquote>
      </section>

      <section className="panel asset-tags-panel">
        <header className="panel-title">
          <span>
            <Tags size={14} />
            Tags
          </span>
        </header>
        <div className="asset-tag-list">
          {metadata.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p>
          <Sparkles size={13} />
          Inferred from {metadata.insightSource}.
        </p>
      </section>
    </aside>
  )
}
