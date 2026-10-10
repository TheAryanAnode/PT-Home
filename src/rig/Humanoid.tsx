import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import type { RegionHighlight } from '../motion/exercises.ts'
import type { ArmPose, JointId, Side } from '../motion/types.ts'
import {
  CLOTH,
  CLOTH_DARK,
  FORE_LEN,
  GHOST,
  HAND_LEN,
  JOINT,
  P,
  SHIN_LEN,
  SKIN,
  THIGH_LEN,
  UPPER_LEN,
} from './layout.ts'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI
const ARC_STEPS = 24

export type SegmentColors = {
  upper?: string
  fore?: string
  hand?: string
  thigh?: string
  shin?: string
  foot?: string
}

export type ArmBones = {
  upper: THREE.Bone
  fore: THREE.Bone
  hand: THREE.Bone
}

export type BoneLock = 'upper' | 'fore' | 'hand' | null

type Highlight = RegionHighlight | null

type HumanoidProps = {
  side?: Side
  pose?: ArmPose
  poseRef?: RefObject<ArmPose | null>
  slerp?: number
  ghost?: boolean
  colors?: SegmentColors
  showSkeleton?: boolean
  showAxes?: boolean
  showSensors?: boolean
  highlight?: Highlight
  rom?: { target: number } | null
  selected?: JointId | null
  onSelect?: (joint: JointId) => void
  lockRef?: RefObject<BoneLock>
  trail?: boolean
  trailJoint?: 'hand' | 'foot'
  trailReset?: number
  /** `both` applies the same leg pose to left and right (squat, heel raise). */
  legDrive?: 'side' | 'both'
  heatmap?: boolean
  heatmapReset?: number
  position?: [number, number, number]
  label?: string
  onBones?: (bones: ArmBones) => void
  onRoot?: (root: THREE.Object3D) => void
}

function xyz(v: readonly [number, number, number]): [number, number, number] {
  return [v[0], v[1], v[2]]
}

function skipRaycast() {}

function Capsule({
  length,
  radius,
  color,
  along,
  ghost,
  hot,
  onClick,
  onOver,
  onOut,
}: {
  length: number
  radius: number
  color: string
  along: 'down' | 'up' | 'out' | 'in'
  ghost?: boolean
  hot?: boolean
  onClick?: (event: { stopPropagation: () => void }) => void
  onOver?: (event: { stopPropagation: () => void }) => void
  onOut?: () => void
}) {
  const cyl = Math.max(0.02, length - radius * 2)
  const pos: [number, number, number] =
    along === 'down'
      ? [0, -length / 2, 0]
      : along === 'up'
        ? [0, length / 2, 0]
        : along === 'out'
          ? [length / 2, 0, 0]
          : [-length / 2, 0, 0]
  const rot: [number, number, number] =
    along === 'out' ? [0, 0, -Math.PI / 2] : along === 'in' ? [0, 0, Math.PI / 2] : [0, 0, 0]
  return (
    <mesh
      position={pos}
      rotation={rot}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerOut={onOut}
      raycast={ghost ? skipRaycast : undefined}
    >
      <capsuleGeometry args={[radius, cyl, 6, 16]} />
      <meshStandardMaterial
        color={color}
        roughness={0.62}
        metalness={0}
        emissive={hot ? '#145e57' : '#000000'}
        emissiveIntensity={hot ? 0.45 : 0}
        transparent={ghost}
        opacity={ghost ? 0.38 : 1}
        depthWrite={!ghost}
      />
    </mesh>
  )
}

function BodyMaterial({ color, ghost }: { color: string; ghost?: boolean }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.68}
      metalness={0}
      transparent={ghost}
      opacity={ghost ? 0.38 : 1}
      depthWrite={!ghost}
    />
  )
}

function JointTag({ title, boneRef }: { title: string; boneRef: RefObject<THREE.Bone | null> }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const euler = useMemo(() => new THREE.Euler(), [])
  useFrame(() => {
    const bone = boneRef.current
    const el = spanRef.current
    if (!bone || !el) return
    euler.setFromQuaternion(bone.quaternion, 'XYZ')
    el.textContent = `${(-euler.x * RAD).toFixed(0)}°`
  })
  return (
    <Html center distanceFactor={1.45} zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
      <div className="joint-tag">
        <strong>{title}</strong>
        <span ref={spanRef}>0°</span>
      </div>
    </Html>
  )
}

function RomArc({ foreRef, target }: { foreRef: RefObject<THREE.Bone | null>; target: number }) {
  const currentGeom = useMemo(() => new THREE.BufferGeometry(), [])
  const targetGeom = useMemo(() => new THREE.BufferGeometry(), [])
  const currentLine = useMemo(() => {
    const line = new THREE.Line(currentGeom, new THREE.LineBasicMaterial({ color: '#f7f1e8' }))
    line.frustumCulled = false
    return line
  }, [currentGeom])
  const targetLine = useMemo(() => {
    const line = new THREE.Line(
      targetGeom,
      new THREE.LineBasicMaterial({ color: '#8eb7ff', transparent: true, opacity: 0.9 }),
    )
    line.frustumCulled = false
    return line
  }, [targetGeom])
  const euler = useMemo(() => new THREE.Euler(), [])

  useFrame(() => {
    const bone = foreRef.current
    if (!bone) return
    euler.setFromQuaternion(bone.quaternion, 'XYZ')
    writeArc(currentGeom, (-euler.x * RAD) || 0)
    writeArc(targetGeom, target, 0.155)
  })

  return (
    <>
      <primitive object={targetLine} />
      <primitive object={currentLine} />
    </>
  )
}

function writeArc(geom: THREE.BufferGeometry, degrees: number, radius = 0.12) {
  let attr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!attr) {
    attr = new THREE.BufferAttribute(new Float32Array((ARC_STEPS + 1) * 3), 3)
    geom.setAttribute('position', attr)
  }
  const arr = attr.array as Float32Array
  for (let i = 0; i <= ARC_STEPS; i += 1) {
    const deg = (degrees * i) / ARC_STEPS
    const a = deg * DEG
    arr[i * 3] = 0
    arr[i * 3 + 1] = -UPPER_LEN - Math.cos(a) * radius
    arr[i * 3 + 2] = Math.sin(a) * radius
  }
  attr.needsUpdate = true
}

function SkeletonLines({ root }: { root: RefObject<THREE.Group | null> }) {
  const geom = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 6), 3))
    geometry.setDrawRange(0, 0)
    return geometry
  }, [])
  const line = useMemo(() => {
    const obj = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#c6fff2' }))
    obj.frustumCulled = false
    return obj
  }, [geom])
  const a = useMemo(() => new THREE.Vector3(), [])
  const b = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const node = root.current
    if (!node) return
    const arr = geom.attributes.position.array as Float32Array
    let count = 0
    node.traverse((obj) => {
      const bone = obj as THREE.Bone
      if (!bone.isBone || count >= 80) return
      const parent = bone.parent as THREE.Bone | null
      if (!parent?.isBone) return
      parent.getWorldPosition(a)
      bone.getWorldPosition(b)
      const offset = count * 6
      arr[offset] = a.x
      arr[offset + 1] = a.y
      arr[offset + 2] = a.z
      arr[offset + 3] = b.x
      arr[offset + 4] = b.y
      arr[offset + 5] = b.z
      count += 1
    })
    geom.setDrawRange(0, count * 2)
    geom.attributes.position.needsUpdate = true
  })

  return <primitive object={line} />
}

function MotionTrail({ anchor, resetKey }: { anchor: RefObject<THREE.Bone | null>; resetKey: number }) {
  const geom = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3))
    geometry.setDrawRange(0, 0)
    return geometry
  }, [])
  const line = useMemo(() => {
    const obj = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#8dffe2' }))
    obj.frustumCulled = false
    return obj
  }, [geom])
  const count = useRef(0)
  const last = useMemo(() => new THREE.Vector3(99, 99, 99), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    count.current = 0
    geom.setDrawRange(0, 0)
  }, [geom, resetKey])

  useFrame(() => {
    const bone = anchor.current
    if (!bone) return
    bone.getWorldPosition(tmp)
    if (count.current > 0 && tmp.distanceTo(last) < 0.012) return
    const arr = geom.attributes.position.array as Float32Array
    const max = 160
    if (count.current < max) {
      const index = count.current
      arr[index * 3] = tmp.x
      arr[index * 3 + 1] = tmp.y
      arr[index * 3 + 2] = tmp.z
      count.current += 1
    } else {
      arr.copyWithin(0, 3)
      arr[(max - 1) * 3] = tmp.x
      arr[(max - 1) * 3 + 1] = tmp.y
      arr[(max - 1) * 3 + 2] = tmp.z
    }
    last.copy(tmp)
    geom.setDrawRange(0, count.current)
    geom.attributes.position.needsUpdate = true
  })

  return <primitive object={line} />
}

function Heatmap({
  anchor,
  resetKey,
  side,
}: {
  anchor: RefObject<THREE.Bone | null>
  resetKey: number
  side: Side
}) {
  const bins = useRef(new Float32Array(80 * 100))
  const canvas = useMemo(() => {
    const element = document.createElement('canvas')
    element.width = 80
    element.height = 100
    return element
  }, [])
  const texture = useMemo(() => {
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [canvas])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    bins.current.fill(0)
  }, [resetKey])

  useFrame(() => {
    const bone = anchor.current
    if (!bone) return
    bone.getWorldPosition(tmp)
    const u = (tmp.z - -0.25) / 1.1
    const v = (tmp.y - 0.45) / 1.25
    if (u > 0 && u < 1 && v > 0 && v < 1) {
      const x = Math.floor(u * 79)
      const y = Math.floor((1 - v) * 99)
      const grid = bins.current
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          const px = x + ox
          const py = y + oy
          if (px < 0 || py < 0 || px >= 80 || py >= 100) continue
          const falloff = 1 - Math.hypot(ox, oy) / 3
          if (falloff > 0) grid[py * 80 + px] += falloff
        }
      }
    }
    const grid = bins.current
    let max = 0.001
    for (let i = 0; i < grid.length; i += 1) {
      grid[i] *= 0.9993
      if (grid[i] > max) max = grid[i]
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(80, 100)
    const data = image.data
    for (let i = 0; i < grid.length; i += 1) {
      const t = Math.min(1, grid[i] / max)
      const color = heatColor(t)
      data[i * 4] = color[0]
      data[i * 4 + 1] = color[1]
      data[i * 4 + 2] = color[2]
      data[i * 4 + 3] = t < 0.04 ? 0 : 220
    }
    ctx.putImageData(image, 0, 0)
    texture.needsUpdate = true
  })

  const x = side === 'right' ? -1.05 : 1.05
  return (
    <group position={[x, 1.08, 0.15]}>
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[0.8, 1.04]} />
        <meshBasicMaterial color="#1a212b" />
      </mesh>
      <mesh>
        <planeGeometry args={[0.72, 0.96]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
      <Html position={[0, 0.6, 0]} center>
        <div className="float-label">Hand heatmap</div>
      </Html>
    </group>
  )
}

function heatColor(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0, 16, 28, 42],
    [0.35, 32, 150, 146],
    [0.7, 230, 168, 48],
    [1, 255, 246, 224],
  ]
  let i = 0
  while (i < stops.length - 2 && t > stops[i + 1][0]) i += 1
  const a = stops[i]
  const b = stops[i + 1]
  const span = b[0] - a[0] || 1
  const u = Math.min(1, Math.max(0, (t - a[0]) / span))
  return [
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
    Math.round(a[3] + (b[3] - a[3]) * u),
  ]
}

function ImuPack({
  color,
  sideSign,
  along = -0.13,
}: {
  color: string
  sideSign: number
  along?: number
}) {
  return (
    <mesh
      position={[0.078 * sideSign, along, -0.044]}
      rotation={[0.12, -sideSign * 0.52, 0.06]}
    >
      <boxGeometry args={[0.024, 0.038, 0.05]} />
      <meshStandardMaterial color={color} roughness={0.42} metalness={0.18} />
    </mesh>
  )
}

function Region({ kind, sign }: { kind: Exclude<Highlight, null>; sign: number }) {
  const position: [number, number, number] =
    kind === 'biceps'
      ? [0, -0.15, 0.072]
      : kind === 'deltoid'
        ? [0.06 * sign, -0.045, 0.02]
        : kind === 'forearm'
          ? [0, -0.12, 0.05]
          : kind === 'hip'
            ? [0.055 * sign, -0.05, 0.02]
            : kind === 'hamstring'
              ? [0, -0.2, -0.072]
              : kind === 'calf'
                ? [0, -0.16, -0.055]
                : [0, -0.18, 0.075]
  return (
    <mesh position={position}>
      <sphereGeometry args={[kind === 'deltoid' ? 0.07 : 0.058, 18, 18]} />
      <meshStandardMaterial
        color="#ffb09f"
        emissive="#e15a42"
        emissiveIntensity={0.28}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
      <Html position={[0, 0.1, 0]} center distanceFactor={1.5}>
        <div className="joint-tag soft">Primary movement region</div>
      </Html>
    </mesh>
  )
}

function Arm({
  side,
  driven,
  upperRef,
  foreRef,
  handRef,
  colors,
  ghost,
  showAxes,
  showSensors,
  highlight,
  rom,
  selected,
  hover,
  onSelect,
  onHover,
}: {
  side: Side
  driven: boolean
  upperRef: RefObject<THREE.Bone | null>
  foreRef: RefObject<THREE.Bone | null>
  handRef: RefObject<THREE.Bone | null>
  colors: SegmentColors
  ghost?: boolean
  showAxes?: boolean
  showSensors?: boolean
  highlight?: Highlight
  rom?: { target: number } | null
  selected?: JointId | null
  hover: JointId | null
  onSelect?: (joint: JointId) => void
  onHover: (joint: JointId | null) => void
}) {
  const sign = side === 'right' ? 1 : -1
  const pick = driven ? selected : null
  const over = driven ? hover : null
  const canPick = Boolean(driven && !ghost && onSelect)
  const names =
    side === 'right'
      ? { s: 'RightShoulder', u: 'RightUpperArm', f: 'RightForeArm', h: 'RightHand' }
      : { s: 'LeftShoulder', u: 'LeftUpperArm', f: 'LeftForeArm', h: 'LeftHand' }
  const upperColor = ghost ? GHOST : driven && colors.upper ? colors.upper : SKIN
  const foreColor = ghost ? GHOST : driven && colors.fore ? colors.fore : SKIN
  const handColor = ghost ? GHOST : driven && colors.hand ? colors.hand : SKIN

  const bind = (joint: JointId) => {
    if (!canPick) return {}
    return {
      onClick: (event: { stopPropagation: () => void }) => {
        event.stopPropagation()
        onSelect?.(joint)
      },
      onOver: (event: { stopPropagation: () => void }) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
        onHover(joint)
      },
      onOut: () => {
        document.body.style.cursor = ''
        onHover(null)
      },
    }
  }

  const marker = (joint: JointId, boneRef: RefObject<THREE.Bone | null>) => {
    const active = pick === joint || over === joint
    if (!canPick) {
      return (
        <mesh raycast={skipRaycast}>
          <sphereGeometry args={[0.032, 14, 14]} />
          <meshStandardMaterial color={ghost ? GHOST : JOINT} transparent={ghost} opacity={ghost ? 0.45 : 1} />
        </mesh>
      )
    }
    const handlers = bind(joint)
    return (
      <mesh onClick={handlers.onClick} onPointerOver={handlers.onOver} onPointerOut={handlers.onOut}>
        <sphereGeometry args={[active ? 0.046 : 0.034, 16, 16]} />
        <meshStandardMaterial
          color={pick === joint ? '#3dbeb6' : JOINT}
          emissive={pick === joint ? '#14635c' : '#000000'}
          emissiveIntensity={pick === joint ? 0.7 : 0}
        />
        {active ? <JointTag title={joint.toUpperCase()} boneRef={boneRef} /> : null}
      </mesh>
    )
  }

  return (
    <bone name={names.s} position={xyz(side === 'right' ? P.shoulderRight : P.shoulderLeft)}>
      <Capsule along={side === 'right' ? 'out' : 'in'} length={0.13} radius={0.034} color={ghost ? GHOST : CLOTH} ghost={ghost} />
      <bone
        ref={driven ? upperRef : undefined}
        name={names.u}
        position={xyz(side === 'right' ? P.upperRight : P.upperLeft)}
        rotation={driven ? undefined : [0, 0, sign * 14 * DEG]}
      >
        <Capsule
          along="down"
          length={UPPER_LEN}
          radius={0.046}
          color={upperColor}
          ghost={ghost}
          hot={pick === 'shoulder'}
          {...bind('shoulder')}
        />
        {marker('shoulder', upperRef)}
        {showAxes && driven ? <axesHelper args={[0.18]} /> : null}
        {showSensors && driven ? <ImuPack color="#e85d4c" sideSign={sign} along={-0.14} /> : null}
        {driven && (highlight === 'biceps' || highlight === 'deltoid') ? <Region kind={highlight} sign={sign} /> : null}
        {rom && driven ? <RomArc foreRef={foreRef} target={rom.target} /> : null}
        <bone
          ref={driven ? foreRef : undefined}
          name={names.f}
          position={xyz(P.fore)}
          rotation={driven ? undefined : [-6 * DEG, 0, 0]}
        >
          <Capsule
            along="down"
            length={FORE_LEN}
            radius={0.038}
            color={foreColor}
            ghost={ghost}
            hot={pick === 'elbow'}
            {...bind('elbow')}
          />
          {marker('elbow', foreRef)}
          {showAxes && driven ? <axesHelper args={[0.16]} /> : null}
          {showSensors && driven ? <ImuPack color="#3ecf8e" sideSign={sign} along={-0.12} /> : null}
          {driven && highlight === 'forearm' ? <Region kind="forearm" sign={sign} /> : null}
          <bone ref={driven ? handRef : undefined} name={names.h} position={xyz(P.hand)}>
            <mesh
              position={[0, -HAND_LEN / 2, 0]}
              raycast={ghost ? skipRaycast : undefined}
              onClick={ghost ? undefined : bind('wrist').onClick}
              onPointerOver={ghost ? undefined : bind('wrist').onOver}
              onPointerOut={ghost ? undefined : bind('wrist').onOut}
            >
              <boxGeometry args={[0.07, HAND_LEN, 0.028]} />
              <meshStandardMaterial
                color={handColor}
                roughness={0.55}
                transparent={ghost}
                opacity={ghost ? 0.38 : 1}
                depthWrite={!ghost}
                emissive={pick === 'wrist' ? '#145e57' : '#000000'}
                emissiveIntensity={pick === 'wrist' ? 0.45 : 0}
              />
            </mesh>
            {marker('wrist', handRef)}
            {showAxes && driven ? <axesHelper args={[0.12]} /> : null}
            {showSensors && driven ? <ImuPack color="#7eb6ff" sideSign={sign} along={-0.028} /> : null}
          </bone>
        </bone>
      </bone>
    </bone>
  )
}

function Leg({
  side,
  driven,
  thighRef,
  shinRef,
  footRef,
  colors,
  ghost,
  highlight,
}: {
  side: Side
  driven: boolean
  thighRef: RefObject<THREE.Bone | null>
  shinRef: RefObject<THREE.Bone | null>
  footRef: RefObject<THREE.Bone | null>
  colors: SegmentColors
  ghost?: boolean
  highlight?: Highlight
}) {
  const sign = side === 'right' ? 1 : -1
  const cloth = ghost ? GHOST : driven && colors.thigh ? colors.thigh : CLOTH
  const skin = ghost ? GHOST : driven && colors.shin ? colors.shin : SKIN
  const footColor = ghost ? GHOST : driven && colors.foot ? colors.foot : CLOTH_DARK
  const name = side === 'right'
    ? { u: 'RightUpLeg', l: 'RightLeg', f: 'RightFoot' }
    : { u: 'LeftUpLeg', l: 'LeftLeg', f: 'LeftFoot' }
  return (
    <bone ref={driven ? thighRef : undefined} name={name.u} position={xyz(side === 'right' ? P.upLegR : P.upLegL)}>
      <Capsule along="down" length={THIGH_LEN} radius={0.067} color={cloth} ghost={ghost} />
      {driven && (highlight === 'quad' || highlight === 'hamstring' || highlight === 'hip') ? (
        <Region kind={highlight} sign={sign} />
      ) : null}
      <mesh position={[0, -THIGH_LEN, 0]} raycast={skipRaycast}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <BodyMaterial color={ghost ? GHOST : JOINT} ghost={ghost} />
      </mesh>
      <bone ref={driven ? shinRef : undefined} name={name.l} position={xyz(P.leg)}>
        <Capsule along="down" length={SHIN_LEN} radius={0.046} color={skin} ghost={ghost} />
        {driven && highlight === 'calf' ? <Region kind="calf" sign={sign} /> : null}
        <bone ref={driven ? footRef : undefined} name={name.f} position={xyz(P.foot)}>
          <mesh position={[0, -0.03, 0.045]} raycast={skipRaycast}>
            <boxGeometry args={[0.09, 0.048, 0.18]} />
            <BodyMaterial color={footColor} ghost={ghost} />
          </mesh>
        </bone>
      </bone>
    </bone>
  )
}

export function Humanoid({
  side = 'right',
  pose,
  poseRef,
  slerp = 0.2,
  ghost,
  colors,
  showSkeleton,
  showAxes,
  showSensors,
  highlight,
  rom,
  selected,
  onSelect,
  lockRef,
  trail,
  trailJoint = 'hand',
  trailReset = 0,
  legDrive = 'both',
  heatmap,
  heatmapReset = 0,
  position,
  label,
  onBones,
  onRoot,
}: HumanoidProps) {
  const rootRef = useRef<THREE.Group>(null)
  const upperRef = useRef<THREE.Bone>(null)
  const foreRef = useRef<THREE.Bone>(null)
  const handRef = useRef<THREE.Bone>(null)
  const thighR = useRef<THREE.Bone>(null)
  const shinR = useRef<THREE.Bone>(null)
  const footR = useRef<THREE.Bone>(null)
  const thighL = useRef<THREE.Bone>(null)
  const shinL = useRef<THREE.Bone>(null)
  const footL = useRef<THREE.Bone>(null)
  const snapped = useRef(false)
  const poseHolder = useRef<ArmPose | null>(null)
  const upperTarget = useMemo(() => new THREE.Quaternion(), [])
  const foreTarget = useMemo(() => new THREE.Quaternion(), [])
  const handTarget = useMemo(() => new THREE.Quaternion(), [])
  const thighTarget = useMemo(() => new THREE.Quaternion(), [])
  const shinTarget = useMemo(() => new THREE.Quaternion(), [])
  const footTarget = useMemo(() => new THREE.Quaternion(), [])
  const [hover, setHover] = useState<JointId | null>(null)
  poseHolder.current = pose ?? null
  const segmentColors = colors ?? {}

  useEffect(() => {
    document.body.style.cursor = ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  useEffect(() => {
    if (rootRef.current) onRoot?.(rootRef.current)
    if (upperRef.current && foreRef.current && handRef.current) {
      onBones?.({ upper: upperRef.current, fore: foreRef.current, hand: handRef.current })
    }
  }, [onBones, onRoot])

  useFrame(() => {
    const src = poseRef?.current ?? poseHolder.current
    const upper = upperRef.current
    const fore = foreRef.current
    const hand = handRef.current
    if (!src || !upper || !fore || !hand) return
    upperTarget.set(src.upper[0], src.upper[1], src.upper[2], src.upper[3])
    foreTarget.set(src.fore[0], src.fore[1], src.fore[2], src.fore[3])
    handTarget.set(src.hand[0], src.hand[1], src.hand[2], src.hand[3])
    const apply = (bone: THREE.Bone, target: THREE.Quaternion, lock: BoneLock) => {
      if (lockRef?.current === lock) return
      if (!snapped.current || slerp >= 0.999) bone.quaternion.copy(target)
      else bone.quaternion.slerp(target, slerp)
    }
    apply(upper, upperTarget, 'upper')
    apply(fore, foreTarget, 'fore')
    apply(hand, handTarget, 'hand')
    thighTarget.set(src.thigh[0], src.thigh[1], src.thigh[2], src.thigh[3])
    shinTarget.set(src.shin[0], src.shin[1], src.shin[2], src.shin[3])
    footTarget.set(src.foot[0], src.foot[1], src.foot[2], src.foot[3])
    const applyLeg = (
      thigh: THREE.Bone | null,
      shin: THREE.Bone | null,
      foot: THREE.Bone | null,
    ) => {
      if (!thigh || !shin || !foot) return
      apply(thigh, thighTarget, null)
      apply(shin, shinTarget, null)
      apply(foot, footTarget, null)
    }
    const bothLegs = legDrive === 'both'
    if (side === 'right' || bothLegs) applyLeg(thighR.current, shinR.current, footR.current)
    if (side === 'left' || bothLegs) applyLeg(thighL.current, shinL.current, footL.current)
    snapped.current = true
  })

  return (
    <group ref={rootRef} position={position ?? [0, 0, 0]}>
      <bone name="Hips" position={xyz(P.hips)}>
        <mesh position={[0, 0.015, 0]} scale={[1.28, 0.72, 0.96]} raycast={skipRaycast}>
          <sphereGeometry args={[0.125, 24, 16]} />
          <BodyMaterial color={ghost ? GHOST : CLOTH_DARK} ghost={ghost} />
        </mesh>
        <bone name="Spine" position={xyz(P.spine)}>
          <Capsule along="up" length={0.12} radius={0.09} color={ghost ? GHOST : CLOTH} ghost={ghost} />
          <bone name="Spine1" position={xyz(P.spine1)}>
            <Capsule along="up" length={0.13} radius={0.105} color={ghost ? GHOST : CLOTH} ghost={ghost} />
            <bone name="Spine2" position={xyz(P.spine2)}>
              <mesh position={[0, 0.03, 0.015]} scale={[1.18, 0.82, 0.76]} raycast={skipRaycast}>
                <sphereGeometry args={[0.15, 24, 18]} />
                <BodyMaterial color={ghost ? GHOST : CLOTH} ghost={ghost} />
              </mesh>
              <bone name="Neck" position={xyz(P.neck)}>
                <Capsule along="up" length={0.09} radius={0.038} color={ghost ? GHOST : SKIN} ghost={ghost} />
                <bone name="Head" position={xyz(P.head)}>
                  <mesh raycast={skipRaycast}>
                    <sphereGeometry args={[0.115, 28, 20]} />
                    <BodyMaterial color={ghost ? GHOST : SKIN} ghost={ghost} />
                  </mesh>
                  <mesh position={[0.038, 0.02, 0.092]} raycast={skipRaycast}>
                    <sphereGeometry args={[0.014, 12, 12]} />
                    <meshStandardMaterial color="#241e1c" roughness={0.35} />
                  </mesh>
                  <mesh position={[-0.038, 0.02, 0.092]} raycast={skipRaycast}>
                    <sphereGeometry args={[0.014, 12, 12]} />
                    <meshStandardMaterial color="#241e1c" roughness={0.35} />
                  </mesh>
                  <mesh position={[0, -0.008, 0.108]} scale={[1, 0.72, 0.7]} raycast={skipRaycast}>
                    <sphereGeometry args={[0.016, 10, 10]} />
                    <BodyMaterial color={ghost ? GHOST : '#d7b5a4'} ghost={ghost} />
                  </mesh>
                  {label ? (
                    <Html position={[0, 0.2, 0]} center>
                      <div className="float-label">{label}</div>
                    </Html>
                  ) : null}
                </bone>
              </bone>
              <Arm
                side="right"
                driven={side === 'right'}
                upperRef={upperRef}
                foreRef={foreRef}
                handRef={handRef}
                colors={segmentColors}
                ghost={ghost}
                showAxes={showAxes}
                showSensors={showSensors}
                highlight={highlight}
                rom={rom}
                selected={selected}
                hover={hover}
                onSelect={onSelect}
                onHover={setHover}
              />
              <Arm
                side="left"
                driven={side === 'left'}
                upperRef={upperRef}
                foreRef={foreRef}
                handRef={handRef}
                colors={segmentColors}
                ghost={ghost}
                showAxes={showAxes}
                showSensors={showSensors}
                highlight={highlight}
                rom={rom}
                selected={selected}
                hover={hover}
                onSelect={onSelect}
                onHover={setHover}
              />
            </bone>
          </bone>
        </bone>
        <Leg
          side="right"
          driven={side === 'right' || legDrive === 'both'}
          thighRef={thighR}
          shinRef={shinR}
          footRef={footR}
          colors={segmentColors}
          ghost={ghost}
          highlight={highlight}
        />
        <Leg
          side="left"
          driven={side === 'left' || legDrive === 'both'}
          thighRef={thighL}
          shinRef={shinL}
          footRef={footL}
          colors={segmentColors}
          ghost={ghost}
          highlight={highlight}
        />
      </bone>
      {showSkeleton ? <SkeletonLines root={rootRef} /> : null}
      {trail ? (
        <MotionTrail
          anchor={trailJoint === 'foot' ? (side === 'right' ? footR : footL) : handRef}
          resetKey={trailReset}
        />
      ) : null}
      {heatmap ? <Heatmap anchor={handRef} resetKey={heatmapReset} side={side} /> : null}
    </group>
  )
}
