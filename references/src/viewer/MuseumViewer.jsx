import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { ArtifactHotspotCard } from '../components/ArtifactHotspotCard.jsx'
import { getArtifactHotspots } from '../data/artifactHotspots.js'
import { advanceCameraPose } from './cameraTransition.js'
import { GeneratedGlbModel } from './GlbArtifactModel.jsx'
import { ViewerErrorBoundary } from './ViewerErrorBoundary.jsx'
import { canUseWebGL } from '../lib/webgl.js'

function CameraTransition({ controlsRef, cameraPosition, focusPose, transitionKey, resetVersion, onTransitioningChange }) {
  const { camera } = useThree()
  const destination = useRef(new Vector3(...cameraPosition))
  const destinationTarget = useRef(new Vector3(0, 0, 0))
  const transitioning = useRef(true)

  useEffect(() => {
    destination.current.copy(focusPose?.position || new Vector3(...cameraPosition))
    destinationTarget.current.copy(focusPose?.target || new Vector3(0, 0, 0))
    transitioning.current = true
    if (controlsRef.current) controlsRef.current.enabled = false
    onTransitioningChange(true)
  }, [cameraPosition, controlsRef, focusPose, onTransitioningChange, resetVersion, transitionKey])

  useFrame((_, delta) => {
    if (!transitioning.current) return
    const controls = controlsRef.current
    const currentTarget = controls?.target || destinationTarget.current
    const pose = advanceCameraPose(camera.position, currentTarget, destination.current, destinationTarget.current, delta)
    camera.position.copy(pose.position)
    if (controls) {
      controls.target.copy(pose.target)
      controls.update()
    } else {
      camera.lookAt(pose.target)
    }
    if (pose.finished) {
      transitioning.current = false
      if (controls) controls.enabled = true
      onTransitioningChange(false)
    }
  })

  return null
}

function RenderArtifact({ data, hotspots, onSelectHotspot }) {
  return (
    <group position={data.modelPosition || [0, 0, 0]}>
      <GeneratedGlbModel
        modelUrl={data.modelPath}
        modelScale={data.modelScale || 1}
        modelRotation={data.modelRotation || [0, 0, 0]}
        hotspots={hotspots}
        onSelectHotspot={onSelectHotspot}
      />
    </group>
  )
}

function Scene({ artifact, autoRotate, resetVersion, focusPose, onSelectHotspot }) {
  const controlsRef = useRef(null)
  const [transitioning, setTransitioning] = useState(true)
  const cameraPosition = useMemo(() => artifact.cameraPosition || [0, 0.12, 5.2], [artifact.cameraPosition])
  const hotspots = useMemo(() => getArtifactHotspots(artifact.id), [artifact.id])

  return (
    <>
      <ambientLight intensity={0.62} color="#d2c7a4" />
      <hemisphereLight intensity={0.62} color="#e1d5b5" groundColor="#1c2722" />
      <directionalLight position={[4.5, 5.5, 4]} intensity={2.3} color="#fff0cf" />
      <directionalLight position={[-4, 2.5, -3]} intensity={1.35} color="#8da894" />
      <spotLight position={[0, 5.5, 1.2]} angle={0.68} penumbra={0.72} intensity={2.1} color="#d5bd83" />
      <Suspense fallback={null}>
        <RenderArtifact data={artifact} hotspots={hotspots} onSelectHotspot={onSelectHotspot} />
      </Suspense>
      <ContactShadows position={[0, -1.72, 0]} opacity={0.32} scale={5.5} blur={2.8} far={3.5} color="#87907f" />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!transitioning}
        enablePan={false}
        enableDamping
        dampingFactor={0.085}
        minDistance={2.2}
        maxDistance={9}
        autoRotate={autoRotate && !focusPose && !transitioning}
        autoRotateSpeed={0.42}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI - 0.08}
      />
      <CameraTransition
        controlsRef={controlsRef}
        cameraPosition={cameraPosition}
        focusPose={focusPose}
        transitionKey={artifact.id}
        resetVersion={resetVersion}
        onTransitioningChange={setTransitioning}
      />
    </>
  )
}

export function MuseumViewer({ artifact, autoRotate = false, resetVersion = 0, onError }) {
  const webglAvailable = canUseWebGL()
  const selectionScope = `${artifact.id}:${resetVersion}`
  const [selectionState, setSelectionState] = useState(() => ({ scope: selectionScope, selection: null }))
  if (selectionState.scope !== selectionScope) {
    setSelectionState({ scope: selectionScope, selection: null })
  }
  const activeSelection = selectionState.scope === selectionScope ? selectionState.selection : null

  if (!webglAvailable) {
    return <div className="viewer-message"><strong>当前浏览器无法启动 WebGL</strong><span>请启用硬件加速或更换浏览器后重试。</span></div>
  }

  function selectHotspot(hotspot, pose) {
    setSelectionState({ scope: selectionScope, selection: { hotspot, pose } })
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
            focusPose={activeSelection?.pose || null}
            onSelectHotspot={selectHotspot}
          />
        </Canvas>
        {activeSelection && (
          <ArtifactHotspotCard
            hotspot={activeSelection.hotspot}
            onExit={() => setSelectionState({ scope: selectionScope, selection: null })}
          />
        )}
      </div>
    </ViewerErrorBoundary>
  )
}
