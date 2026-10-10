import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

const DEFAULT_CAM: [number, number, number] = [1.62, 1.16, 2.72]
const DEFAULT_LOOK: [number, number, number] = [0, 1.02, 0]

export function Scene({
  children,
  camera = DEFAULT_CAM,
  look = DEFAULT_LOOK,
  onMiss,
}: {
  children?: ReactNode
  camera?: [number, number, number]
  look?: [number, number, number]
  onMiss?: () => void
}) {
  const cameraProps = useRef({
    position: [camera[0], camera[1], camera[2]] as [number, number, number],
    fov: 36,
  })
  const lookRef = useRef(look)

  return (
    <Canvas
      camera={cameraProps.current}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
      onPointerMissed={onMiss}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <color attach="background" args={['#14171c']} />
      <fog attach="fog" args={['#14171c', 7.5, 13]} />
      <hemisphereLight args={['#e8eeff', '#3c342c', 0.62]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[3.4, 5.6, 2.8]} intensity={2.35} />
      <directionalLight position={[-2.6, 2.4, -1.6]} intensity={0.42} color="#9eb6ff" />
      <Grid
        args={[8, 8]}
        cellSize={0.25}
        cellThickness={0.6}
        cellColor="#2a303a"
        sectionSize={1}
        sectionThickness={1.15}
        sectionColor="#3c4553"
        fadeDistance={6.5}
        fadeStrength={1.4}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.46, 48]} />
        <meshBasicMaterial color="#050608" transparent opacity={0.38} />
      </mesh>
      {children}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.09}
        target={lookRef.current}
        minDistance={0.65}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
    </Canvas>
  )
}

export function GlideCamera({
  cam,
  look,
  token,
}: {
  cam: [number, number, number]
  look: [number, number, number]
  token: string
}) {
  const { camera, controls } = useThree()
  const left = useRef(0)
  const goalP = useMemo(() => new THREE.Vector3(), [])
  const goalL = useMemo(() => new THREE.Vector3(), [])
  const camRef = useRef(cam)
  const lookRef = useRef(look)
  camRef.current = cam
  lookRef.current = look

  useEffect(() => {
    goalP.set(camRef.current[0], camRef.current[1], camRef.current[2])
    goalL.set(lookRef.current[0], lookRef.current[1], lookRef.current[2])
    left.current = 0.75
  }, [goalL, goalP, token])

  useFrame((_, dt) => {
    if (left.current <= 0) return
    left.current = Math.max(0, left.current - dt)
    const k = 1 - Math.pow(0.015, dt)
    camera.position.lerp(goalP, k)
    const orbit = controls as { target?: THREE.Vector3; update?: () => void } | null
    orbit?.target?.lerp(goalL, k)
    orbit?.update?.()
  })

  return null
}
