import './ArtifactHotspots.css'

export function ArtifactHotspotCard({ hotspot, onExit }) {
  return (
    <section className="artifact-hotspot-card" role="region" aria-label="热点讲解">
      <header className="artifact-hotspot-card-header">
        <span>STRUCTURE GUIDE</span>
        <button type="button" onClick={onExit}>
          退出
        </button>
      </header>
      <h2>{hotspot.name}</h2>
      <p>{hotspot.description}</p>
    </section>
  )
}
