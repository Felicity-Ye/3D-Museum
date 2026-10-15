import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { GeneratedGlbModel } from './GlbArtifactModel.jsx'
import { ViewerErrorBoundary } from './ViewerErrorBoundary.jsx'
import { canUseWebGL } from '../lib/webgl.js'

function CameraTransition({ controlsRef, cameraPosition, transitionKey, resetVersion }) {
  const { camera } = useThree()
  const destination = useRef(new Vector3(...cameraPosition))
  const target = useRef(new Vector3(0, 0, 0))
  const transitioning = useRef(true)

  useEffect(() => {
    destination.current.set(...cameraPosition)
    target.current.set(0, 0, 0)
    transitioning.current = true
  }, [cameraPosition, transitionKey, resetVersion])

  useFrame((_, delta) => {
    if (!transitioning.current) return
    const alpha = 1 - Math.exp(-4.2 * delta)
    camera.position.lerp(destination.current, alpha)
    if (controlsRef.current) {
      controlsRef.current.target.lerp(target.current, alpha)
      controlsRef.current.update()
    } else {
      camera.lookAt(target.current)
    }
    const cameraDistance = camera.position.distanceToSquared(destination.current)
    const targetDistance = controlsRef.current?.target.distanceToSquared(target.current) || 0
    if (cameraDistance < 0.0004 && targetDistance < 0.0004) {
      camera.position.copy(destination.current)
      controlsRef.current?.target.copy(target.current)
      transitioning.current = false
    }
  })

  return null
}

function RenderArtifact({ data }) {
  return (
    <group position={data.modelPosition || [0, 0, 0]}>
      <GeneratedGlbModel
        modelUrl={data.modelPath}
        modelScale={data.modelScale || 1}
        modelRotation={data.modelRotation || [0, 0, 0]}
      />
    </group>
  )
}

function Scene({ artifact, autoRotate, resetVersion }) {
  const controlsRef = useRef(null)
  const cameraPosition = useMemo(() => artifact.cameraPosition || [0, 0.12, 5.2], [artifact.cameraPosition])

  return (
    <>
      <ambientLight intensity={0.62} color="#d2c7a4" />
      <hemisphereLight intensity={0.62} color="#e1d5b5" groundColor="#1c2722" />
      <directionalLight position={[4.5, 5.5, 4]} intensity={2.3} color="#fff0cf" />
      <directionalLight position={[-4, 2.5, -3]} intensity={1.35} color="#8da894" />
      <spotLight position={[0, 5.5, 1.2]} angle={0.68} penumbra={0.72} intensity={2.1} color="#d5bd83" />
      <Suspense fallback={null}>
        <RenderArtifact data={artifact} />
      </Suspense>
      <ContactShadows position={[0, -1.72, 0]} opacity={0.32} scale={5.5} blur={2.8} far={3.5} color="#87907f" />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.085}
        minDistance={2.2}
        maxDistance={9}
        autoRotate={autoRotate}
        autoRotateSpeed={0.42}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI - 0.08}
      />
      <CameraTransition
        controlsRef={controlsRef}
        cameraPosition={cameraPosition}
        transitionKey={artifact.id}
        resetVersion={resetVersion}
      />
    </>
  )
}

export function MuseumViewer({ artifact, autoRotate = false, resetVersion = 0, onError }) {
  const webglAvailable = canUseWebGL()

  if (!webglAvailable) {
    return <div className="viewer-message"><strong>当前浏览器无法启动 WebGL</strong><span>请启用硬件加速或更换浏览器后重试。</span></div>
  }

  return (
    <ViewerErrorBoundary
      resetKey={artifact.id}
      onError={onError}
      fallback={<div className="viewer-message"><strong>模型载入失败</strong><span>请检查 GLB 文件是否完整，然后切换文物或重新载入页面。</span></div>}
    >
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
        <Scene artifact={artifact} autoRotate={autoRotate} resetVersion={resetVersion} />
      </Canvas>
    </ViewerErrorBoundary>
  )
}
