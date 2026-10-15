import { useRef } from 'react'
import { Box, Image, Upload } from 'lucide-react'

import { GENERATION_MODE_OPTIONS } from '../config/appConfig.js'
import { MICROSCOPE_IMAGES } from '../domain/cellData.js'
import { getCell } from '../domain/cellCatalog.js'
import { CellThumb } from './CellThumb.jsx'

export function BottomDeck({
  selectedCell,
  selectedMicroscope,
  setSelectedMicroscope,
  uploadedImage,
  generationMode,
  onGenerationModeChange,
  compareCell,
  customCells,
  latestUploadCell,
  onUploadImage,
  onCompare,
  onOpenGenerationCell,
  onNotify,
}) {
  const fileInputRef = useRef(null)
  const selected = getCell(selectedCell, customCells)
  const compareTarget = getCell(compareCell, customCells)
  const uploadAccept = generationMode === 'local' ? '.glb,.gltf,model/gltf-binary,model/gltf+json' : 'image/*,.glb,.gltf,model/gltf-binary,model/gltf+json'

  function handleMicroscopeSelect(item) {
    setSelectedMicroscope(item.label)
    onNotify(item.note)
  }

  return (
    <section className="bottom-deck">
      <div className="panel media-panel">
        <header className="panel-title">
          <span>Asset Source</span>
          <small>{latestUploadCell ? 5 : 4}</small>
        </header>
        <div className="generation-mode-row">
          <span>Provider</span>
          <div className="generation-mode-pills">
            {GENERATION_MODE_OPTIONS.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={generationMode === mode.id ? 'active' : ''}
                onClick={() => {
                  onGenerationModeChange(mode.id)
                  onNotify(`${mode.label} mode selected`)
                }}
                title={mode.description}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <div className="micro-grid">
          {MICROSCOPE_IMAGES.map((item) => (
            <button
              key={item.label}
              type="button"
              className={selectedMicroscope === item.label ? `micro-card ${item.tone} active` : `micro-card ${item.tone}`}
              onClick={() => handleMicroscopeSelect(item)}
            >
              <span />
              <small>{item.label}</small>
            </button>
          ))}
          {latestUploadCell ? (
            <>
              <button
                type="button"
                className={uploadedImage ? `add-image active ${uploadedImage.url ? 'with-preview' : 'with-model'}` : 'add-image active with-model'}
                style={uploadedImage?.url ? { '--upload-preview': `url(${uploadedImage.url})` } : undefined}
                onClick={() => onOpenGenerationCell(latestUploadCell.id)}
                title="Open latest uploaded model"
              >
                {uploadedImage?.url ? <Image size={16} /> : <Box size={16} />}
                {latestUploadCell.name || uploadedImage?.name || 'Latest Asset'}
              </button>
              <button type="button" className="add-image upload-new" onClick={() => fileInputRef.current?.click()} title="Upload a new image or GLB">
                <Upload size={16} />
                New Upload
              </button>
            </>
          ) : (
            <button
              type="button"
              className="add-image"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              Add Image / GLB
            </button>
          )}
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept={uploadAccept}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              onUploadImage(file)
              event.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="panel compare-panel">
        <header className="panel-title">
          <span>Compare Models</span>
          <small>2</small>
        </header>
        <button type="button" className="compare-box" onClick={() => onCompare(compareTarget.id)}>
          <CellThumb cell={selected} selected />
          <div>
            <strong>{selected.name.replace(' Cell', '')}</strong>
            <small>{selected.type}</small>
          </div>
          <span className="versus">VS</span>
          <CellThumb cell={compareTarget} />
          <div>
            <strong>{compareTarget.name}</strong>
            <small>{compareTarget.type.replace('Human ', '')}</small>
          </div>
        </button>
      </div>

    </section>
  )
}
