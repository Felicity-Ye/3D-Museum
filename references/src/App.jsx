import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import {
  Bookmark, Camera, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Expand, Maximize2, RotateCcw, RotateCw, Search, X,
} from 'lucide-react'
import { artifacts } from './data/artifacts.js'
import { ArtifactMarkdown } from './components/ArtifactMarkdown.jsx'
import { parseArtifactMarkdown } from './components/artifactMarkdown.js'
import { MuseumViewer } from './viewer/MuseumViewer.jsx'
import './App.css'

const categories = [
  { id: 'all', label: '全部文物' },
  { id: '青铜器', label: '青铜器' },
  { id: '金器', label: '金器' },
]

function InfoValue({ label, value }) {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{value || '资料待补充'}</dd>
    </div>
  )
}

function artifactDisplayName(artifact) {
  if (artifact.name && artifact.name !== '文物名称待补充') return artifact.name
  return artifact.fileName.replace(/\.glb$/i, '')
}

function Header({ category, setCategory, search, setSearch, autoRotate, setAutoRotate, demoMode, setDemoMode }) {
  return (
    <header className="topbar">
      <div className="brand-group">
        <span className="brand-mark" aria-hidden="true">堆</span>
        <div className="brand-copy">
          <strong>三星堆文物讲解</strong>
          {/* <span>非官方数字展示</span> */}
        </div>
      </div>
      <nav className="category-nav" aria-label="文物分类">
        {categories.map((item) => (
          <button key={item.id} className={category === item.id ? 'selected' : ''} onClick={() => setCategory(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="topbar-spacer" />
      <label className="search-box">
        <Search size={15} strokeWidth={1.7} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索文物…" aria-label="搜索文物" />
        {search && <button aria-label="清除搜索" onClick={() => setSearch('')}><X size={14} /></button>}
      </label>
      <button className={`topbar-control ${autoRotate ? 'active' : ''}`} onClick={() => setAutoRotate(!autoRotate)}>
        <RotateCw size={15} /> <span>自转</span>
      </button>
      <button className={`topbar-control demo-toggle ${demoMode ? 'active' : ''}`} onClick={() => setDemoMode(!demoMode)}>
        <Maximize2 size={14} /> <span>{demoMode ? '退出演示' : '演示'}</span>
      </button>
    </header>
  )
}

function ArtifactList({ items, selectedId, onSelect }) {
  return (
    <aside className="left-panel panel-scroll">
      <div className="panel-heading">
        <div><span className="eyebrow">COLLECTION</span><h2>馆藏文物</h2></div>
        <span className="item-count">共 {String(items.length).padStart(2, '0')} 件</span>
      </div>
      <div className="artifact-list">
        {items.map((artifact, index) => (
          <button key={artifact.id} className={`artifact-list-item ${artifact.id === selectedId ? 'active' : ''}`} onClick={() => onSelect(artifact.id)}>
            <span className="artifact-thumb" aria-hidden="true">
              <Bookmark size={16} strokeWidth={1.3} />
              {artifact.thumbnailPath && <img src={artifact.thumbnailPath} alt="" loading="lazy" />}
              <small>{String(index + 1).padStart(2, '0')}</small>
            </span>
            <span className="artifact-list-copy">
              <strong>{artifactDisplayName(artifact)}</strong>
              <small>{artifact.category || '类别待补充'}</small>
              <em className={artifact.category === '金器' ? 'gold-tag' : ''}>{artifact.category || '资料待补充'}</em>
            </span>
            <span className="active-pin" />
          </button>
        ))}
        {items.length === 0 && <p className="empty-list">没有找到对应文物。</p>}
      </div>
      <div className="list-footnote"><span className="footnote-mark">三星堆</span><span>文物条目根据本地 GLB 清单显示</span></div>
    </aside>
  )
}

function ArtifactDetails({ artifact }) {
  const panelRef = useRef(null)
  const contentSections = useMemo(
    () => Object.fromEntries(parseArtifactMarkdown(artifact.contentMarkdown).map((section) => [section.key, section])),
    [artifact.contentMarkdown],
  )

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [artifact.id])

  const sections = [
    { key: 'description', title: '文物描述', icon: '▤' },
  ]

  return (
    <aside ref={panelRef} className="right-panel panel-scroll" aria-label="文物详细资料">
      <div className="detail-heading"><Bookmark size={16} /><h2>文物详情</h2></div>
      <details open className="detail-section">
        <summary><span className="section-icon">⌑</span>基本信息<ChevronDown size={14} /></summary>
        <dl>
          <InfoValue label="年代" value={artifact.period} />
          <InfoValue label="材质" value={artifact.material} />
          <InfoValue label="尺寸" value={artifact.dimensions} />
          <InfoValue label="文物类别" value={artifact.category} />
        </dl>
      </details>
      {sections.map((section) => (
        <details open className="detail-section" key={section.key}>
          <summary><span className="section-icon">{section.icon}</span>{section.title}<ChevronDown size={14} /></summary>
          <ArtifactMarkdown
            key={`${artifact.id}-${section.key}`}
            markdown={contentSections[section.key]?.markdown || ''}
            description={section.key === 'description'}
            className="detail-prose"
          />
        </details>
      ))}
      {Object.values(contentSections).filter((section) => section.key.startsWith('additional-')).map((section) => (
        <details open className="detail-section" key={section.key}>
          <summary><span className="section-icon">◇</span>{section.title}<ChevronDown size={14} /></summary>
          <ArtifactMarkdown markdown={section.markdown} className="detail-prose" />
        </details>
      ))}
      <details open className="detail-section">
        <summary><span className="section-icon">◇</span>标签<ChevronDown size={14} /></summary>
        <div className="tag-list">
          {(artifact.keywords?.length ? artifact.keywords : ['AI 辅助三维重建']).map((keyword) => <span key={keyword}>{keyword}</span>)}
        </div>
      </details>
      <div className="model-note"><CircleHelp size={14} /><span>{artifact.modelAttribution || 'AI 辅助三维重建，仅供数字展示'}</span></div>
    </aside>
  )
}

function StageControls({ artifact, index, count, onPrevious, onNext, onReset, onScreenshot, onFullscreen }) {
  const { active, progress } = useProgress()
  return (
    <>
      <div className="stage-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="stage-title-card">
        <span className="stage-index">{String(index + 1).padStart(2, '0')} <i /> {String(count).padStart(2, '0')}</span>
        <motion.div key={artifact.id} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <h1>{artifactDisplayName(artifact)}</h1>
          <p>{artifact.period || '资料待补充'}<span>·</span>{artifact.category || '类别待补充'}</p>
        </motion.div>
      </div>
      {active && (
        <div className="stage-loading">
          <span className="loading-orbit" />
          <span>正在载入模型 {Math.round(progress)}%</span>
        </div>
      )}
      <div className="stage-arrow stage-arrow-left">
        <button aria-label="上一件文物" onClick={onPrevious}><ChevronLeft size={19} /></button>
      </div>
      <div className="stage-arrow stage-arrow-right">
        <button aria-label="下一件文物" onClick={onNext}><ChevronRight size={19} /></button>
      </div>
      <div className="stage-tool-stack">
        <button aria-label="重置视角" title="重置视角" onClick={onReset}><RotateCcw size={16} /></button>
        <button aria-label="截图" title="截图" onClick={onScreenshot}><Camera size={16} /></button>
        <button aria-label="全屏" title="全屏" onClick={onFullscreen}><Expand size={15} /></button>
      </div>
      <div className="stage-hint"><span>↔</span> 拖拽旋转 <i /> 滚轮缩放</div>
      <div className="stage-bottom-label"><span>{artifact.category || '藏品'}</span></div>
    </>
  )
}

export default function App() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(artifacts[0]?.id || '')
  const [autoRotate, setAutoRotate] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const [toast, setToast] = useState('')
  const shellRef = useRef(null)
  const stageRef = useRef(null)
  const activeRotation = autoRotate || demoMode

  const visibleArtifacts = useMemo(() => artifacts.filter((artifact) => {
    const matchesCategory = category === 'all' || artifact.category === category
    const query = search.trim().toLocaleLowerCase()
    const matchesSearch = !query || `${artifact.name} ${artifact.category} ${artifact.fileName}`.toLocaleLowerCase().includes(query)
    return matchesCategory && matchesSearch
  }), [category, search])

  const artifact = visibleArtifacts.find((item) => item.id === selectedId) || visibleArtifacts[0] || artifacts.find((item) => item.id === selectedId) || artifacts[0]
  const selectedIndex = artifacts.findIndex((item) => item.id === artifact?.id)

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  function selectRelative(offset) {
    if (!artifacts.length) return
    const nextIndex = (selectedIndex + offset + artifacts.length) % artifacts.length
    setSelectedId(artifacts[nextIndex].id)
  }

  function takeScreenshot() {
    const canvas = stageRef.current?.querySelector('canvas')
    if (!canvas) return setToast('当前画面暂不可截图')
    canvas.toBlob((blob) => {
      if (!blob) return setToast('截图失败，请重试')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${artifact?.id || 'sanxingdui'}-view.png`
      anchor.click()
      URL.revokeObjectURL(url)
      setToast('截图已保存')
    }, 'image/png')
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await shellRef.current?.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      setToast('当前浏览器不支持全屏')
    }
  }

  if (!artifacts.length) {
    return <main className="no-artifacts"><span className="brand-mark">堆</span><h1>尚未找到本地 GLB 文物模型</h1><p>请将 .glb 文件放入项目根目录的 public/models/，重新启动后即可加入展览。</p></main>
  }

  return (
    <main ref={shellRef} className={`museum-app ${demoMode ? 'demo-mode' : ''}`}>
      <Header
        category={category}
        setCategory={setCategory}
        search={search}
        setSearch={setSearch}
        autoRotate={activeRotation}
        setAutoRotate={(value) => { setAutoRotate(value); setDemoMode(false) }}
        demoMode={demoMode}
        setDemoMode={setDemoMode}
      />
      <div className="museum-layout">
        <ArtifactList items={visibleArtifacts} selectedId={artifact?.id} onSelect={setSelectedId} />
        <section ref={stageRef} className="viewer-stage" aria-label="3D 文物展示区域">
          {artifact && <MuseumViewer artifact={artifact} autoRotate={activeRotation} resetVersion={resetVersion} onError={() => setToast('模型载入失败，请检查 GLB 文件')} />}
          <StageControls
            artifact={artifact}
            index={selectedIndex}
            count={artifacts.length}
            onPrevious={() => selectRelative(-1)}
            onNext={() => selectRelative(1)}
            onReset={() => setResetVersion((value) => value + 1)}
            onScreenshot={takeScreenshot}
            onFullscreen={toggleFullscreen}
          />
          <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>{toast}</motion.div>}</AnimatePresence>
        </section>
        <ArtifactDetails artifact={artifact} />
      </div>
      <footer className="site-disclaimer">个人学习性质的非官方数字展示项目 · AI 辅助三维重建，仅供数字展示</footer>
    </main>
  )
}
