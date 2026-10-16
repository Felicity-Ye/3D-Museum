import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { Vector3 } from 'three'
import { ArtifactHotspotCard } from '../components/ArtifactHotspotCard.jsx'
import { getArtifactTour } from '../data/artifactTours.js'
import { getArtifactHotspots } from '../data/artifactHotspots.js'
import {
  advanceTour,
  arriveAtTourCamera,
  createTourState,
  exitTour,
  getTourControlMode,
  moveTourChapter,
  pauseTour,
  resumeTour,
  startTour,
} from './tourPlayer.js'
import { interpolateCameraPose } from './cameraTransition.js'
import { GeneratedGlbModel } from './GlbArtifactModel.jsx'
import { ViewerErrorBoundary } from './ViewerErrorBoundary.jsx'
import { canUseWebGL } from '../lib/webgl.js'

const TOUR_CAMERA_MIN_DISTANCE = 2.5

function keepCameraOutsideModel(pose) {
  const direction = pose.position.clone().sub(pose.target)
  if (direction.length() < TOUR_CAMERA_MIN_DISTANCE) {
    if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1)
    direction.setLength(TOUR_CAMERA_MIN_DISTANCE)
    return { ...pose, position: pose.target.clone().add(direction) }
  }
  return pose
}

function overviewPose(cameraPosition, zoom = 1) {
  const target = new Vector3(0, 0, 0)
  const position = new Vector3(...cameraPosition).sub(target).multiplyScalar(zoom).add(target)
  return { position, target }
}

function CameraTransition({
  controlsRef,
  cameraPosition,
  focusPose,
  transitionKey,
  transitionDuration,
  resetVersion,
  paused,
  onTransitioningChange,
  onTransitionComplete,
}) {
  const { camera, invalidate } = useThree()
  const startPosition = useRef(new Vector3(...cameraPosition))
  const startTarget = useRef(new Vector3(0, 0, 0))
  const destination = useRef(new Vector3(...cameraPosition))
  const destinationTarget = useRef(new Vector3(0, 0, 0))
  const duration = useRef(1)
  const elapsed = useRef(0)
  const transitioning = useRef(true)
  const pausedRef = useRef(paused)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    startPosition.current.copy(camera.position)
    startTarget.current.copy(controlsRef.current?.target || new Vector3(0, 0, 0))
    destination.current.copy(focusPose?.position || new Vector3(...cameraPosition))
    destinationTarget.current.copy(focusPose?.target || new Vector3(0, 0, 0))
    duration.current = transitionDuration
    elapsed.current = 0
    transitioning.current = true
    if (controlsRef.current) controlsRef.current.enabled = false
    onTransitioningChange(true)
    let previousTime = performance.now()
    let frameId
    const animate = (now) => {
      if (!transitioning.current) return
      if (pausedRef.current) {
        previousTime = now
        frameId = window.requestAnimationFrame(animate)
        return
      }
      elapsed.current += Math.min((now - previousTime) / 1000, 0.05)
      previousTime = now
      const pose = interpolateCameraPose(
        startPosition.current,
        startTarget.current,
        destination.current,
        destinationTarget.current,
        elapsed.current,
        duration.current,
      )
      camera.position.copy(pose.position)
      if (controlsRef.current) {
        controlsRef.current.target.copy(pose.target)
        controlsRef.current.update()
      } else {
        camera.lookAt(pose.target)
      }
      invalidate()
      if (pose.finished) {
        transitioning.current = false
        onTransitioningChange(false)
        onTransitionComplete(transitionKey)
        return
      }
      frameId = window.requestAnimationFrame(animate)
    }
    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [camera, cameraPosition, controlsRef, focusPose, invalidate, onTransitionComplete, onTransitioningChange, resetVersion, transitionDuration, transitionKey])

  return null
}

function RenderArtifact({ data, hotspots, onSelectHotspot, hotspotsInteractive, onHotspotPoseResolver }) {
  return (
    <group position={data.modelPosition || [0, 0, 0]}>
      <GeneratedGlbModel
        modelUrl={data.modelPath}
        modelScale={data.modelScale || 1}
        modelRotation={data.modelRotation || [0, 0, 0]}
        hotspots={hotspots}
        hotspotsInteractive={hotspotsInteractive}
        onSelectHotspot={onSelectHotspot}
        onHotspotPoseResolver={onHotspotPoseResolver}
      />
    </group>
  )
}

function Scene({
  artifact,
  autoRotate,
  resetVersion,
  selection,
  selectionVersion,
  onSelectHotspot,
  onHotspotPoseResolver,
  hotspotPoseResolver,
  tourChapters,
  tourState,
  onTourCameraComplete,
}) {
  const controlsRef = useRef(null)
  const [transitioning, setTransitioning] = useState(true)
  const cameraPosition = useMemo(() => artifact.cameraPosition || [0, 0.12, 5.2], [artifact.cameraPosition])
  const hotspots = useMemo(() => getArtifactHotspots(artifact.id), [artifact.id])
  const tourActive = tourState.status === 'playing' || tourState.status === 'paused'
  const tourOwnsCamera = tourActive || tourState.phase === 'final-transition'
  const tourReturning = tourState.phase === 'final-transition' || tourState.phase === 'completed'
  const tourChapter = tourChapters?.[tourState.chapterIndex]
  const tourPose = useMemo(() => {
    if (!tourOwnsCamera) return null
    if (tourReturning) return overviewPose(cameraPosition)
    if (tourChapter?.hotspotId) {
      const pose = hotspotPoseResolver?.(tourChapter.hotspotId)
      return pose ? keepCameraOutsideModel(pose) : null
    }
    if (tourChapter?.cameraPreset === 'overview') return overviewPose(cameraPosition, 0.88)
    return null
  }, [cameraPosition, hotspotPoseResolver, tourChapter, tourOwnsCamera, tourReturning])
  const focusPose = tourOwnsCamera ? tourPose : selection?.pose || null
  const transitionKey = tourOwnsCamera
    ? `tour:${tourState.requestId}`
    : `${artifact.id}:manual:${selectionVersion}:${resetVersion}`
  const transitionDuration = tourOwnsCamera
    ? (tourState.phase === 'final-transition' ? tourChapters?.at(-1)?.transitionDuration || 2 : tourChapter?.transitionDuration || 2)
    : tourState.status === 'completed' ? 0.05 : 1

  return (
    <>
      <ambientLight intensity={0.62} color="#d2c7a4" />
      <hemisphereLight intensity={0.62} color="#e1d5b5" groundColor="#1c2722" />
      <directionalLight position={[4.5, 5.5, 4]} intensity={2.3} color="#fff0cf" />
      <directionalLight position={[-4, 2.5, -3]} intensity={1.35} color="#8da894" />
      <spotLight position={[0, 5.5, 1.2]} angle={0.68} penumbra={0.72} intensity={2.1} color="#d5bd83" />
      <Suspense fallback={null}>
        <RenderArtifact
          data={artifact}
          hotspots={hotspots}
          onSelectHotspot={onSelectHotspot}
          hotspotsInteractive={!tourActive}
          onHotspotPoseResolver={onHotspotPoseResolver}
        />
      </Suspense>
      <ContactShadows position={[0, -1.72, 0]} opacity={0.32} scale={5.5} blur={2.8} far={3.5} color="#87907f" />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!transitioning && !tourActive}
        enablePan={false}
        enableDamping
        dampingFactor={0.085}
        minDistance={2.2}
        maxDistance={9}
        autoRotate={autoRotate && !selection && !tourActive && !transitioning}
        autoRotateSpeed={0.42}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI - 0.08}
      />
      <CameraTransition
        controlsRef={controlsRef}
        cameraPosition={cameraPosition}
        focusPose={focusPose}
        transitionKey={transitionKey}
        transitionDuration={transitionDuration}
        resetVersion={resetVersion}
        paused={tourState.status === 'paused'}
        onTransitioningChange={setTransitioning}
        onTransitionComplete={onTourCameraComplete}
      />
    </>
  )
}

function TourControls({ chapters, state, canStart, onStart, onTogglePause, onPrevious, onNext, onExit, onReplay }) {
  if (!chapters) return null
  const controlMode = getTourControlMode(state)
  if (controlMode !== 'player') {
    const isReplay = controlMode === 'replay'
    return (
      <div className="artifact-tour-start-wrap">
        <button type="button" className="artifact-tour-start" onClick={isReplay ? onReplay : onStart} disabled={!isReplay && !canStart}>
          <Play size={14} fill="currentColor" />
          {isReplay ? '重播导览' : '开始参观'}
        </button>
        {!isReplay && !canStart && <span className="artifact-tour-loading">模型载入中</span>}
      </div>
    )
  }

  const chapter = chapters[state.chapterIndex]
  const duration = chapter?.duration || 1
  const progress = state.phase === 'final-transition' || state.phase === 'completed'
    ? 1
    : Math.min(1, (state.chapterIndex + state.elapsed / duration) / chapters.length)
  const chapterNumber = Math.min(state.chapterIndex + 1, chapters.length)

  return (
    <>
      {chapter && (
        <div className="artifact-tour-caption" role="status" aria-live="polite">
          <span>{chapter.title}</span>
          <p>{chapter.narration}</p>
        </div>
      )}
      <div className="artifact-tour-player" aria-label="自动导览控制">
        <div className="artifact-tour-player-top">
          <div className="artifact-tour-chapter-label">
            <span>{`第 ${chapterNumber} / ${chapters.length} 章`}</span>
            <strong>{chapter?.title || '文物全貌'}</strong>
          </div>
          <span className="artifact-tour-progress-text">{Math.round(progress * 100)}%</span>
        </div>
        <div className="artifact-tour-progress" aria-label="导览进度">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="artifact-tour-player-controls">
          <button type="button" aria-label="上一章节" onClick={onPrevious} disabled={state.chapterIndex === 0}>
            <ChevronLeft size={15} />上一章
          </button>
          <button type="button" className="tour-play-toggle" aria-label={state.status === 'paused' ? '继续导览' : '暂停导览'} onClick={onTogglePause}>
            {state.status === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} />}
            {state.status === 'paused' ? '继续' : '暂停'}
          </button>
          <button type="button" aria-label="下一章节" onClick={onNext}>
            下一章<ChevronRight size={15} />
          </button>
          <button type="button" className="tour-exit" aria-label="退出导览" onClick={onExit}>
            <X size={14} />退出
          </button>
        </div>
      </div>
    </>
  )
}

export function MuseumViewer({ artifact, autoRotate = false, resetVersion = 0, onError }) {
  const webglAvailable = canUseWebGL()
  const selectionScope = `${artifact.id}:${resetVersion}`
  const [selectionState, setSelectionState] = useState(() => ({ scope: selectionScope, selection: null, version: 0 }))
  const [tourSession, setTourSession] = useState(() => ({ scope: selectionScope, state: createTourState() }))
  const [modelPoseState, setModelPoseState] = useState(() => ({ scope: selectionScope, resolver: null }))
  if (selectionState.scope !== selectionScope) setSelectionState({ scope: selectionScope, selection: null, version: 0 })
  if (tourSession.scope !== selectionScope) setTourSession({ scope: selectionScope, state: createTourState() })
  if (modelPoseState.scope !== selectionScope) setModelPoseState({ scope: selectionScope, resolver: null })

  const activeSelection = selectionState.scope === selectionScope ? selectionState.selection : null
  const selectionVersion = selectionState.scope === selectionScope ? selectionState.version : 0
  const tourState = tourSession.scope === selectionScope ? tourSession.state : createTourState()
  const hotspotPoseResolver = modelPoseState.scope === selectionScope ? modelPoseState.resolver : null
  const tourChapters = useMemo(() => getArtifactTour(artifact.id), [artifact.id])
  const tourLocked = tourState.status === 'playing' || tourState.status === 'paused'

  const onHotspotPoseResolver = useCallback((resolver) => {
    setModelPoseState({ scope: selectionScope, resolver })
  }, [selectionScope])

  const updateTour = useCallback((updater) => {
    setTourSession((current) => {
      if (current.scope !== selectionScope) return current
      const next = typeof updater === 'function' ? updater(current.state) : updater
      return next === current.state ? current : { ...current, state: next }
    })
  }, [selectionScope])

  const onTourCameraComplete = useCallback((transitionKey) => {
    if (!transitionKey.startsWith('tour:')) return
    const requestId = Number(transitionKey.slice('tour:'.length))
    setTourSession((current) => {
      if (current.scope !== selectionScope) return current
      const state = arriveAtTourCamera(current.state, requestId)
      return state === current.state ? current : { ...current, state }
    })
  }, [selectionScope])

  useEffect(() => {
    if (!tourChapters || tourState.status !== 'playing' || tourState.phase !== 'narration') return undefined
    let lastFrame = null
    let carriedTime = 0
    let frameId
    const tick = (now) => {
      if (lastFrame !== null) {
        carriedTime += Math.min((now - lastFrame) / 1000, 0.25)
        if (carriedTime >= 0.1) {
          const delta = carriedTime
          carriedTime = 0
          setTourSession((current) => {
            if (current.scope !== selectionScope) return current
            const state = advanceTour(current.state, delta, tourChapters)
            return state === current.state ? current : { ...current, state }
          })
        }
      }
      lastFrame = now
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [selectionScope, tourChapters, tourState.chapterIndex, tourState.phase, tourState.requestId, tourState.status])

  if (!webglAvailable) {
    return <div className="viewer-message"><strong>当前浏览器无法启动 WebGL</strong><span>请启用硬件加速或更换浏览器后重试。</span></div>
  }

  function selectHotspot(hotspot, pose) {
    if (tourLocked) return
    setSelectionState((current) => ({
      scope: selectionScope,
      selection: { hotspot, pose },
      version: current.scope === selectionScope ? current.version + 1 : 1,
    }))
  }

  function clearSelection() {
    setSelectionState((current) => ({
      scope: selectionScope,
      selection: null,
      version: current.scope === selectionScope ? current.version + 1 : 1,
    }))
  }

  function beginTour() {
    if (!tourChapters || !hotspotPoseResolver) return
    clearSelection()
    updateTour((state) => startTour(state, tourChapters))
  }

  function toggleTourPause() {
    updateTour((state) => state.status === 'paused' ? resumeTour(state) : pauseTour(state))
  }

  function changeTourChapter(delta) {
    updateTour((state) => moveTourChapter(state, state.chapterIndex + delta, tourChapters || []))
  }

  function leaveTour() {
    updateTour(exitTour)
    clearSelection()
  }

  return (
    <ViewerErrorBoundary
      resetKey={artifact.id}
      onError={onError}
      fallback={<div className="viewer-message"><strong>模型载入失败</strong><span>请检查 GLB 文件是否完整，然后切换文物或重新载入页面。</span></div>}
    >
      <div className="artifact-viewer-shell">
        <Canvas
          className="artifact-canvas"
          camera={{ position: artifact.cameraPosition || [0, 0.12, 5.2], fov: 35 }}
          dpr={[1, 1.5]}
          shadows
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.setClearColor('#080908', 1)
          }}
        >
          <color attach="background" args={['#080908']} />
          <Scene
            artifact={artifact}
            autoRotate={autoRotate}
            resetVersion={resetVersion}
            selection={activeSelection}
            selectionVersion={selectionVersion}
            onSelectHotspot={selectHotspot}
            onHotspotPoseResolver={onHotspotPoseResolver}
            hotspotPoseResolver={hotspotPoseResolver}
            tourChapters={tourChapters}
            tourState={tourState}
            onTourCameraComplete={onTourCameraComplete}
          />
        </Canvas>
        {activeSelection && !tourLocked && (
          <ArtifactHotspotCard hotspot={activeSelection.hotspot} onExit={clearSelection} />
        )}
        <TourControls
          chapters={tourChapters}
          state={tourState}
          canStart={Boolean(hotspotPoseResolver)}
          onStart={beginTour}
          onTogglePause={toggleTourPause}
          onPrevious={() => changeTourChapter(-1)}
          onNext={() => changeTourChapter(1)}
          onExit={leaveTour}
          onReplay={beginTour}
        />
      </div>
    </ViewerErrorBoundary>
  )
}
