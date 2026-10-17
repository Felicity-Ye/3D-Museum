import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Captions, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
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
  seekTour,
} from './tourPlayer.js'
import { interpolateCameraPose } from './cameraTransition.js'
import { cameraPoseAtTime, subtitleAtTime } from './tourTimeline.js'
import { TourAudioEngine } from './tourAudioEngine.js'
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

function resolveTourKeyframe(frame, cameraPosition, hotspotPoseResolver) {
  let pose = frame.hotspotId
    ? hotspotPoseResolver?.(frame.hotspotId)
    : frame.cameraPreset?.startsWith('overview')
      ? overviewPose(cameraPosition, frame.cameraPreset === 'overview-close' ? 0.88 : 1)
      : null
  if (!pose) return null
  if (frame.cameraPreset?.endsWith('-close')) {
    const direction = pose.position.clone().sub(pose.target)
    pose = { ...pose, position: pose.target.clone().add(direction.multiplyScalar(0.82)) }
  }
  return pose
}

function formatTime(value) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function tourTrackKey(scope, requestId, chapterIndex) {
  return `${scope}:${requestId}:${chapterIndex}`
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
  audioRef,
  timelineKeyframes,
  resolveTimelineKeyframe,
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
    if (timelineKeyframes?.length && audioRef?.current) {
      const audio = audioRef.current
      const timelineAnchor = {
        position: camera.position.clone(),
        target: controlsRef.current?.target.clone() || new Vector3(0, 0, 0),
      }
      let frameId
      let lastTime = null
      let active = true
      let arrived = false
      transitioning.current = false
      onTransitioningChange(false)
      const applyAtAudioTime = () => {
        if (!active) return
        const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
        if ((!pausedRef.current && !audio.paused) || time !== lastTime) {
          const pose = cameraPoseAtTime(timelineKeyframes, time, resolveTimelineKeyframe, timelineAnchor)
          if (pose) {
            camera.position.copy(pose.position)
            if (controlsRef.current) {
              controlsRef.current.target.copy(pose.target)
              controlsRef.current.update()
            } else camera.lookAt(pose.target)
            invalidate()
          }
          if (!arrived && time >= timelineKeyframes[0].time) {
            arrived = true
            onTransitioningChange(false)
            onTransitionComplete(transitionKey)
          }
          lastTime = time
        }
        frameId = window.requestAnimationFrame(applyAtAudioTime)
      }
      applyAtAudioTime()
      return () => {
        active = false
        window.cancelAnimationFrame(frameId)
      }
    }

    return undefined
  }, [audioRef, camera, controlsRef, invalidate, onTransitionComplete, onTransitioningChange, resolveTimelineKeyframe, timelineKeyframes, transitionKey])

  useEffect(() => {
    if (timelineKeyframes?.length && audioRef?.current) return undefined
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
  }, [audioRef, camera, cameraPosition, controlsRef, focusPose, invalidate, onTransitionComplete, onTransitioningChange, resetVersion, resolveTimelineKeyframe, timelineKeyframes, transitionDuration, transitionKey])

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
  audioRef,
  audioTrackEnabled,
}) {
  const controlsRef = useRef(null)
  const [transitioning, setTransitioning] = useState(true)
  const cameraPosition = useMemo(() => artifact.cameraPosition || [0, 0.12, 5.2], [artifact.cameraPosition])
  const hotspots = useMemo(() => getArtifactHotspots(artifact.id), [artifact.id])
  const tourActive = tourState.status === 'playing' || tourState.status === 'paused'
  const tourOwnsCamera = tourActive || tourState.phase === 'final-transition'
  const tourReturning = tourState.phase === 'final-transition' || tourState.phase === 'completed'
  const tourChapter = tourChapters?.[tourState.chapterIndex]
  const keyframes = useMemo(() => tourChapter?.cameraKeyframes || [], [tourChapter])
  const resolveKeyframe = useCallback((frame) => resolveTourKeyframe(frame, cameraPosition, hotspotPoseResolver), [cameraPosition, hotspotPoseResolver])
  const tourPose = useMemo(() => {
    if (!tourOwnsCamera) return null
    if (tourReturning) return overviewPose(cameraPosition)
    if (audioTrackEnabled && keyframes[0]) return resolveKeyframe(keyframes[0])
    if (tourChapter?.hotspotId) {
      const pose = hotspotPoseResolver?.(tourChapter.hotspotId)
      return pose ? keepCameraOutsideModel(pose) : null
    }
    if (tourChapter?.cameraPreset === 'overview') return overviewPose(cameraPosition, 0.88)
    return null
  }, [audioTrackEnabled, cameraPosition, hotspotPoseResolver, keyframes, resolveKeyframe, tourChapter, tourOwnsCamera, tourReturning])
  const focusPose = tourOwnsCamera ? tourPose : selection?.pose || null
  const transitionKey = tourOwnsCamera
    ? `tour:${tourState.requestId}`
    : `${artifact.id}:manual:${selectionVersion}:${resetVersion}`
  const transitionDuration = tourOwnsCamera
    ? (tourState.phase === 'final-transition' ? tourChapters?.at(-1)?.transitionDuration || 2 : tourChapter?.transitionDuration || 2)
    : tourState.status === 'completed' ? 0.05 : 1
  const timelineKeyframes = audioTrackEnabled && ['transition', 'narration'].includes(tourState.phase) ? keyframes : null

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
        audioRef={audioRef}
        timelineKeyframes={timelineKeyframes}
        resolveTimelineKeyframe={resolveKeyframe}
        onTransitioningChange={setTransitioning}
        onTransitionComplete={onTourCameraComplete}
      />
    </>
  )
}

function TourControls({ chapters, state, canStart, audio, onStart, onTogglePause, onPrevious, onNext, onExit, onReplay, onSeek, onToggleMute, onVolumeChange, onToggleCaptions }) {
  const [playerPosition, setPlayerPosition] = useState(null)
  const dragState = useRef(null)
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
  const duration = audio?.duration || chapter?.duration || 1
  const currentTime = Math.min(audio?.currentTime || 0, duration)
  const progress = state.phase === 'final-transition' || state.phase === 'completed'
    ? 1
    : Math.min(1, (state.chapterIndex + currentTime / duration) / chapters.length)
  const chapterNumber = Math.min(state.chapterIndex + 1, chapters.length)
  const subtitle = audio?.usingAudio ? audio.currentSubtitle : chapter?.narration
  const showCaption = Boolean(chapter && audio?.captionsEnabled && subtitle)
  function startPlayerDrag(event) {
    if (event.button !== 0) return
    const stage = event.currentTarget.closest('.viewer-stage')
    const container = event.currentTarget.closest('.artifact-tour-container')
    if (!stage || !container) return
    const stageRect = stage.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    dragState.current = {
      pointerId: event.pointerId,
      stageRect,
      playerWidth: containerRect.width,
      playerHeight: containerRect.height,
      startX: event.clientX,
      startY: event.clientY,
      left: containerRect.left - stageRect.left,
      top: containerRect.top - stageRect.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function movePlayerDrag(event) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const maxLeft = Math.max(0, drag.stageRect.width - drag.playerWidth)
    const maxTop = Math.max(0, drag.stageRect.height - drag.playerHeight)
    setPlayerPosition({
      left: Math.max(0, Math.min(maxLeft, drag.left + event.clientX - drag.startX)),
      top: Math.max(0, Math.min(maxTop, drag.top + event.clientY - drag.startY)),
    })
  }
  function endPlayerDrag(event) {
    if (dragState.current?.pointerId === event.pointerId) dragState.current = null
  }
  function movePlayerByKeyboard(event) {
    const offsets = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    const stageRect = event.currentTarget.closest('.viewer-stage')?.getBoundingClientRect()
    const containerRect = event.currentTarget.closest('.artifact-tour-container')?.getBoundingClientRect()
    if (!stageRect || !containerRect) return
    const left = playerPosition?.left ?? containerRect.left - stageRect.left
    const top = playerPosition?.top ?? containerRect.top - stageRect.top
    setPlayerPosition({
      left: Math.max(0, Math.min(Math.max(0, stageRect.width - containerRect.width), left + offset[0])),
      top: Math.max(0, Math.min(Math.max(0, stageRect.height - containerRect.height), top + offset[1])),
    })
  }

  return (
    <div className="artifact-tour-container" style={playerPosition ? { left: playerPosition.left, top: playerPosition.top, right: 'auto', bottom: 'auto', margin: 0 } : undefined}>
      <div className={`artifact-tour-caption${showCaption ? '' : ' is-hidden'}`} role="status" aria-live="polite" aria-hidden={!showCaption}>
        <span>{chapter?.title || ''}</span>
        <p>{showCaption ? subtitle : ''}</p>
      </div>
      <div className="artifact-tour-player" aria-label="自动导览控制">
        <div className="artifact-tour-player-top" role="group" tabIndex={0} aria-label="拖动导览框，可用方向键移动" title="拖动以移动导览框" onKeyDown={movePlayerByKeyboard} onPointerDown={startPlayerDrag} onPointerMove={movePlayerDrag} onPointerUp={endPlayerDrag} onPointerCancel={endPlayerDrag}>
          <div className="artifact-tour-chapter-label">
            <span>{`第 ${chapterNumber} / ${chapters.length} 章`}</span>
            <strong>{chapter?.title || '文物全貌'}</strong>
          </div>
          <span className="artifact-tour-progress-text">{Math.round(progress * 100)}%</span>
        </div>
        <div className="artifact-tour-progress" aria-label="导览进度">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="artifact-tour-time-row">
          <input type="range" className="artifact-tour-seek" aria-label="章节播放进度" min="0" max={duration} step="0.05" value={currentTime} disabled={state.phase === 'final-transition' || (state.phase !== 'narration' && !audio?.usingAudio)} onChange={(event) => onSeek(Number(event.target.value))} />
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
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
        <div className="artifact-tour-audio-controls">
          {audio?.hasAudio && <>
            <button type="button" aria-label={audio?.muted ? '取消静音' : '静音'} onClick={onToggleMute}>
              {audio?.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input type="range" aria-label="讲解音量" min="0" max="1" step="0.05" value={audio?.volume ?? 0.82} onChange={(event) => onVolumeChange(Number(event.target.value))} />
          </>}
          <button type="button" className={audio?.captionsEnabled ? 'active' : ''} aria-label={audio?.captionsEnabled ? '关闭字幕' : '开启字幕'} onClick={onToggleCaptions}>
            <Captions size={14} />字幕
          </button>
        </div>
      </div>
    </div>
  )
}

export function MuseumViewer({ artifact, autoRotate = false, resetVersion = 0, onError }) {
  const webglAvailable = canUseWebGL()
  const selectionScope = `${artifact.id}:${resetVersion}`
  const [selectionState, setSelectionState] = useState(() => ({ scope: selectionScope, selection: null, version: 0 }))
  const [tourSession, setTourSession] = useState(() => ({ scope: selectionScope, state: createTourState() }))
  const [modelPoseState, setModelPoseState] = useState(() => ({ scope: selectionScope, resolver: null }))
  const audioRef = useRef(null)
  const audioScopeRef = useRef(selectionScope)
  const audioEngineRef = useRef(null)
  const audioHandlersRef = useRef({})
  const tourChaptersRef = useRef(null)
  const [audioUi, setAudioUi] = useState({ trackKey: null, currentTime: 0, duration: 0, subtitles: [], failed: false, muted: false, volume: 0.82, captionsEnabled: true })
  if (selectionState.scope !== selectionScope) setSelectionState({ scope: selectionScope, selection: null, version: 0 })
  if (tourSession.scope !== selectionScope) setTourSession({ scope: selectionScope, state: createTourState() })
  if (modelPoseState.scope !== selectionScope) setModelPoseState({ scope: selectionScope, resolver: null })

  useLayoutEffect(() => {
    if (audioScopeRef.current === selectionScope) return
    audioScopeRef.current = selectionScope
    audioEngineRef.current?.unload()
  }, [selectionScope])

  const activeSelection = selectionState.scope === selectionScope ? selectionState.selection : null
  const selectionVersion = selectionState.scope === selectionScope ? selectionState.version : 0
  const tourState = tourSession.scope === selectionScope ? tourSession.state : createTourState()
  const hotspotPoseResolver = modelPoseState.scope === selectionScope ? modelPoseState.resolver : null
  const tourChapters = useMemo(() => getArtifactTour(artifact.id), [artifact.id])
  const tourLocked = tourState.status === 'playing' || tourState.status === 'paused'
  const currentChapter = tourChapters?.[tourState.chapterIndex]
  const currentTrackKey = tourTrackKey(selectionScope, tourState.requestId, tourState.chapterIndex)
  const usingAudio = Boolean(currentChapter?.audioUrl && audioUi.trackKey === currentTrackKey && audioUi.usingAudio && !audioUi.failed)
  const chapterDuration = usingAudio && audioUi.duration > 0 ? audioUi.duration : currentChapter?.duration || 1
  const chapterTime = usingAudio ? audioUi.currentTime : tourState.elapsed
  const timedSubtitle = usingAudio ? subtitleAtTime(audioUi.subtitles, audioUi.currentTime)?.text : null
  const currentSubtitle = usingAudio
    ? timedSubtitle || (audioUi.subtitles.length ? '' : currentChapter?.narration || '')
    : currentChapter?.narration || ''
  useEffect(() => {
    tourChaptersRef.current = tourChapters
  }, [tourChapters])

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

  const audioHandlers = useMemo(() => ({
    onTimeUpdate(token, currentTime, duration) {
      const key = tourTrackKey(token.scope, token.requestId, token.chapterIndex)
      setAudioUi((current) => current.trackKey === key ? { ...current, currentTime, duration: Number.isFinite(duration) ? duration : current.duration } : current)
      setTourSession((current) => {
        if (current.scope !== token.scope || current.state.requestId !== token.requestId || current.state.chapterIndex !== token.chapterIndex || !['playing', 'paused'].includes(current.state.status)) return current
        if (current.state.elapsed === currentTime) return current
        return { ...current, state: { ...current.state, elapsed: currentTime } }
      })
    },
    onEnded(token) {
      setTourSession((current) => {
        const state = current.state
        if (current.scope !== token.scope || state.requestId !== token.requestId || state.chapterIndex !== token.chapterIndex || state.status !== 'playing' || !['transition', 'narration'].includes(state.phase)) return current
        const next = moveTourChapter(state, state.chapterIndex + 1, tourChaptersRef.current || [])
        return next === state ? current : { ...current, state: next }
      })
    },
    onError(token) {
      const key = tourTrackKey(token.scope, token.requestId, token.chapterIndex)
      setAudioUi((current) => current.trackKey === key ? { ...current, failed: true, usingAudio: false } : current)
      setTourSession((current) => {
        if (current.scope !== token.scope || current.state.requestId !== token.requestId || current.state.chapterIndex !== token.chapterIndex) return current
        return { ...current, state: { ...current.state, elapsed: 0 } }
      })
    },
  }), [])
  useEffect(() => {
    audioHandlersRef.current = audioHandlers
  }, [audioHandlers])

  useEffect(() => {
    if (typeof Audio === 'undefined') return undefined
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    audioEngineRef.current = new TourAudioEngine(audio, {
      onTimeUpdate: (...args) => audioHandlersRef.current.onTimeUpdate?.(...args),
      onMetadata: (...args) => audioHandlersRef.current.onTimeUpdate?.(...args),
      onEnded: (...args) => audioHandlersRef.current.onEnded?.(...args),
      onError: (...args) => audioHandlersRef.current.onError?.(...args),
    })
    return () => {
      audioEngineRef.current?.destroy()
      audioEngineRef.current = null
      audioRef.current = null
    }
  }, [])

  const preloadTourTrack = tourState.status === 'idle' || tourState.status === 'completed'
  const audioChapter = preloadTourTrack ? tourChapters?.[0] : currentChapter
  const audioTrackUrl = tourState.phase === 'final-transition' ? null : audioChapter?.audioUrl
  const audioToken = useMemo(() => ({
    scope: selectionScope,
    requestId: tourState.requestId,
    chapterIndex: preloadTourTrack ? 0 : tourState.chapterIndex,
  }), [preloadTourTrack, selectionScope, tourState.chapterIndex, tourState.requestId])
  const audioChapterKey = tourTrackKey(audioToken.scope, audioToken.requestId, audioToken.chapterIndex)

  useEffect(() => {
    const engine = audioEngineRef.current
    if (!engine) return undefined
    if (!audioTrackUrl) {
      engine.unload()
      return undefined
    }

    engine.load(audioTrackUrl, audioToken)
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setAudioUi((current) => ({ ...current, trackKey: audioChapterKey, currentTime: 0, duration: 0, subtitles: audioChapter.subtitles || [], failed: false, usingAudio: true }))
    })
    const controller = new AbortController()
    if (audioChapter.subtitlesUrl) {
      fetch(audioChapter.subtitlesUrl, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Subtitle request failed: ${response.status}`)
          return response.json()
        })
        .then((subtitles) => {
          if (Array.isArray(subtitles)) setAudioUi((current) => current.trackKey === audioChapterKey ? { ...current, subtitles } : current)
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setAudioUi((current) => current.trackKey === audioChapterKey ? { ...current, subtitles: audioChapter.subtitles || [] } : current)
        })
    }
    return () => {
      cancelled = true
      controller.abort()
      engine.unload(audioToken)
    }
  }, [audioChapterKey, audioChapter, audioChapter?.subtitlesUrl, audioToken, audioTrackUrl, preloadTourTrack])

  useEffect(() => {
    audioEngineRef.current?.setVolume(audioUi.volume)
    audioEngineRef.current?.setMuted(audioUi.muted)
  }, [audioUi.muted, audioUi.volume])

  useEffect(() => {
    const engine = audioEngineRef.current
    if (!engine || !usingAudio) return undefined
    if (tourState.status === 'paused') {
      engine.pause()
      return undefined
    }
    if (tourState.status === 'playing') void engine.play()
    else engine.pause()
    return undefined
  }, [usingAudio, tourState.status, tourState.requestId, tourState.chapterIndex])

  useEffect(() => {
    if (!tourChapters || tourState.status !== 'playing' || tourState.phase !== 'narration') return undefined
    const hasAudio = Boolean(currentChapter?.audioUrl)
    const audioFailed = audioUi.trackKey === currentTrackKey && audioUi.failed
    if (hasAudio && !audioFailed) return undefined
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
  }, [audioUi.failed, audioUi.trackKey, currentChapter?.audioUrl, currentTrackKey, selectionScope, tourChapters, tourState.chapterIndex, tourState.phase, tourState.requestId, tourState.status])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (usingAudio && tourState.status === 'playing') void audioEngineRef.current?.play()
      if (usingAudio && audioRef.current) setAudioUi((current) => ({ ...current, currentTime: audioRef.current.currentTime }))
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [tourState.status, usingAudio])

  const onTourCameraComplete = useCallback((transitionKey) => {
    if (!transitionKey.startsWith('tour:')) return
    const requestId = Number(transitionKey.slice('tour:'.length))
    setTourSession((current) => {
      if (current.scope !== selectionScope) return current
      const state = arriveAtTourCamera(current.state, requestId)
      return state === current.state ? current : { ...current, state }
    })
  }, [selectionScope])

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
    const nextState = startTour(tourState, tourChapters)
    const firstChapter = tourChapters[0]
    const token = { scope: selectionScope, requestId: nextState.requestId, chapterIndex: 0 }
    if (firstChapter?.audioUrl && audioEngineRef.current) {
      const generation = audioEngineRef.current.load(firstChapter.audioUrl, token)
      setAudioUi((current) => ({ ...current, trackKey: tourTrackKey(selectionScope, nextState.requestId, 0), currentTime: 0, duration: 0, subtitles: firstChapter.subtitles || [], failed: false, usingAudio: true }))
      void audioEngineRef.current.play(generation)
    }
    updateTour(nextState)
  }

  function toggleTourPause() {
    if (tourState.status === 'paused') {
      updateTour((state) => resumeTour(state))
      if (usingAudio) void audioEngineRef.current?.play()
    } else {
      audioEngineRef.current?.pause()
      if (usingAudio && audioRef.current) setAudioUi((current) => ({ ...current, currentTime: audioRef.current.currentTime }))
      updateTour((state) => pauseTour(state))
    }
  }

  function changeTourChapter(delta) {
    updateTour((state) => moveTourChapter(state, state.chapterIndex + delta, tourChapters || []))
  }

  function leaveTour() {
    audioEngineRef.current?.unload()
    setAudioUi((current) => ({ ...current, currentTime: 0, duration: 0, failed: false, usingAudio: false }))
    updateTour(exitTour)
    clearSelection()
  }

  function seekChapter(time) {
    if (usingAudio) {
      audioEngineRef.current?.seek(time)
      setAudioUi((current) => ({ ...current, currentTime: time }))
      updateTour((state) => ({ ...state, elapsed: time }))
    } else {
      updateTour((state) => seekTour(state, time, tourChapters || []))
    }
  }

  function changeVolume(volume) {
    audioEngineRef.current?.setVolume(volume)
    setAudioUi((current) => ({ ...current, volume }))
  }

  function toggleMute() {
    setAudioUi((current) => {
      const muted = !current.muted
      audioEngineRef.current?.setMuted(muted)
      return { ...current, muted }
    })
  }

  function toggleCaptions() {
    setAudioUi((current) => ({ ...current, captionsEnabled: !current.captionsEnabled }))
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
            audioRef={audioRef}
            audioTrackEnabled={usingAudio && tourLocked}
          />
        </Canvas>
        {activeSelection && !tourLocked && (
          <ArtifactHotspotCard hotspot={activeSelection.hotspot} onExit={clearSelection} />
        )}
        <TourControls
          chapters={tourChapters}
          state={tourState}
          canStart={Boolean(hotspotPoseResolver)}
          audio={{ currentTime: chapterTime, duration: chapterDuration, usingAudio, hasAudio: Boolean(currentChapter?.audioUrl && audioUi.trackKey === currentTrackKey && !audioUi.failed), currentSubtitle, muted: audioUi.muted, volume: audioUi.volume, captionsEnabled: audioUi.captionsEnabled }}
          onStart={beginTour}
          onTogglePause={toggleTourPause}
          onPrevious={() => changeTourChapter(-1)}
          onNext={() => changeTourChapter(1)}
          onExit={leaveTour}
          onReplay={beginTour}
          onSeek={seekChapter}
          onToggleMute={toggleMute}
          onVolumeChange={changeVolume}
          onToggleCaptions={toggleCaptions}
        />
      </div>
    </ViewerErrorBoundary>
  )
}
