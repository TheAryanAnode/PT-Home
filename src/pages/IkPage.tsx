import { TransformControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { solveArmIk } from '../motion/ik.ts'
import { createArm, writeArm } from '../motion/types.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { SHOULDER } from '../rig/layout.ts'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { SideToggle, Stat, TestPage } from '../ui/widgets.tsx'

export function IkPage() {
  const side = useRehab((state) => state.side)
  const poseRef = useRef(createArm())
  const meshRef = useRef<THREE.Mesh>(null)
  const reached = useRef(new THREE.Vector3())
  const sideRef = useRef(side)
  const [readout, setReadout] = useState({ elbow: 0, error: 0, clamped: false })
  const shot = frameFor('elbow', side)
  sideRef.current = side

  function solveAt(position: THREE.Vector3) {
    const solved = solveArmIk(position, sideRef.current)
    writeArm(poseRef.current, solved.arm)
    reached.current.copy(solved.reached)
    return solved
  }

  return (
    <TestPage
      kicker="IK"
      title="Reach"
      lede="Drag the blue target. A two-bone solver points the upper arm and bends the elbow so the wrist meets it, as long as the point is inside the arm’s reach."
      note={readout.clamped ? 'Target is out of reach' : 'Drag the blue target'}
      panel={
        <div className="stack">
          <SideToggle />
          <Stat label="Elbow flexion" value={`${readout.elbow.toFixed(0)}°`} />
          <Stat
            label="Wrist error"
            value={`${readout.error.toFixed(1)} cm`}
            tone={readout.clamped ? 'warn' : 'ok'}
            hint="Distance from the solved wrist to the clamped target."
          />
          <p>This is the “show me where to reach” test. The hand follows the cursor target without rotating each joint by hand.</p>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look}>
        <Humanoid key={`figure-${side}`} side={side} poseRef={poseRef} slerp={0.35} />
        <ReachHandle
          key={`handle-${side}`}
          meshRef={meshRef}
          reached={reached}
          side={side}
          onSolve={(position) => {
            const solved = solveAt(position)
            setReadout({
              elbow: solved.elbowFlexion,
              error: solved.errorCm,
              clamped: solved.clamped,
            })
          }}
        />
        <GlideCamera cam={shot.cam} look={shot.look} token={side} />
      </Scene>
    </TestPage>
  )
}

function ReachHandle({
  meshRef,
  reached,
  side,
  onSolve,
}: {
  meshRef: RefObject<THREE.Mesh | null>
  reached: RefObject<THREE.Vector3>
  side: 'right' | 'left'
  onSolve: (position: THREE.Vector3) => void
}) {
  const controls = useThree((state) => state.controls) as { enabled?: boolean } | null
  const controlsRef = useRef(controls)
  const solveRef = useRef(onSolve)
  controlsRef.current = controls
  solveRef.current = onSolve
  const start = useMemo(() => {
    const shoulder = SHOULDER[side]
    return new THREE.Vector3(shoulder[0], shoulder[1] - 0.28, 0.38)
  }, [side])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.position.copy(start)
    solveRef.current(mesh.position)
  }, [meshRef, start])

  const down = useCallback(() => {
    if (controlsRef.current) controlsRef.current.enabled = false
  }, [])
  const up = useCallback(() => {
    if (controlsRef.current) controlsRef.current.enabled = true
    if (meshRef.current) solveRef.current(meshRef.current.position)
  }, [meshRef])
  const change = useCallback(() => {
    if (meshRef.current) solveRef.current(meshRef.current.position)
  }, [meshRef])

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshStandardMaterial color="#8eb7ff" emissive="#214e9a" emissiveIntensity={0.45} />
      </mesh>
      <ReachLine meshRef={meshRef} reached={reached} side={side} />
      <TransformControls
        object={meshRef as RefObject<THREE.Object3D>}
        mode="translate"
        size={0.7}
        onMouseDown={down}
        onMouseUp={up}
        onObjectChange={change}
      />
    </>
  )
}

function ReachLine({
  meshRef,
  reached,
  side,
}: {
  meshRef: RefObject<THREE.Mesh | null>
  reached: RefObject<THREE.Vector3>
  side: 'right' | 'left'
}) {
  const geom = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    return geometry
  }, [])
  const line = useMemo(() => {
    const obj = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#8eb7ff' }))
    obj.frustumCulled = false
    return obj
  }, [geom])
  const marker = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const mesh = meshRef.current
    const hand = reached.current
    const dot = marker.current
    if (!mesh || !hand || !dot) return
    const shoulder = SHOULDER[side]
    const arr = geom.attributes.position.array as Float32Array
    arr[0] = shoulder[0]
    arr[1] = shoulder[1]
    arr[2] = shoulder[2]
    arr[3] = mesh.position.x
    arr[4] = mesh.position.y
    arr[5] = mesh.position.z
    geom.attributes.position.needsUpdate = true
    dot.position.copy(hand)
  })

  return (
    <>
      <primitive object={line} />
      <mesh ref={marker}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshStandardMaterial color="#f4f0e8" />
      </mesh>
    </>
  )
}
