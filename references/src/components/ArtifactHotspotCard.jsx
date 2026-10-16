import { ExternalLink, X } from 'lucide-react'
import './ArtifactHotspots.css'

export function ArtifactHotspotCard({ hotspot, onExit }) {
  return (
    <section className="artifact-hotspot-card" role="region" aria-label="热点讲解">
      <header className="artifact-hotspot-card-header">
        <span>STRUCTURE GUIDE</span>
        <button type="button" aria-label="关闭热点讲解" onClick={onExit}>
          <X size={15} />
        </button>
      </header>
      <h2>{hotspot.name}</h2>
      <p>{hotspot.description}</p>
      <footer>
        <a href={hotspot.sourceUrl} target="_blank" rel="noreferrer">
          三星堆博物馆 <ExternalLink size={12} aria-hidden="true" />
        </a>
        <button type="button" onClick={onExit}>退出热点观察</button>
      </footer>
    </section>
  )
}
