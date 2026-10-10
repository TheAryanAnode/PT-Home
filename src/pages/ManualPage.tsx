import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useRef, useState } from 'react'
import * as THREE from 'three'
import { anglesFromArm, poseFromAngles } from '../motion/quat.ts'
import { READY_ANGLES, createArm, writeArm, type JointAngles, type JointId, type Side } from '../motion/types.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid, type ArmBones, type BoneLock } from '../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { Slider, TestPage } from '../ui/widgets.tsx'

const LOCK: Record<JointId, Exclude<BoneLock, null>> = {
  shoulder: 'upper',
  elbow: 'fore',
  wrist: 'hand',
}

function RotateGizmo({
  bone,
  onChange,
  onDrag,
}: {
  bone: THREE.Object3D
  onChange: () => void
  onDrag: (dragging: boolean) => void
}) {
  const controls = useThree((state) => state.controls) as { enabled?: boolean } | null
  const changeRef = useRef(onChange)
  const dragRef = useRef(onDrag)
  const controlsRef = useRef(controls)
  changeRef.current = onChange
  dragRef.current = onDrag
  controlsRef.current = controls

  const down = useCallback(() => {
    dragRef.current(true)
    if (controlsRef.current) controlsRef.current.enabled = false
  }, [])
  const up = useCallback(() => {
    changeRef.current()
    dragRef.current(false)
    if (controlsRef.current) controlsRef.current.enabled = true
  }, [])
  const change = useCallback(() => changeRef.current(), [])

  return (
    <TransformControls
      object={bone}
      mode="rotate"
      space="local"
      size={0.72}
      onMouseDown={down}
      onMouseUp={up}
      onObjectChange={change}
    />
  )
}

function qText(q: number[]) {
  return q.map((value) => value.toFixed(2)).join('  ')
}

export function ManualPage() {
  const side = useRehab((state) => state.side)
  const setSide = useRehab((state) => state.setSide)
  const saveTarget = useRehab((state) => state.saveTarget)
  const hasCustomTarget = useRehab((state) => state.hasCustomTarget)
  const [angles, setAngles] = useState<JointAngles>(READY_ANGLES)
  const [selected, setSelected] = useState<JointId>('elbow')
  const [bones, setBones] = useState<ArmBones | null>(null)
  const poseRef = useRef(createArm(poseFromAngles(READY_ANGLES, 'right')))
  const lockRef = useRef<BoneLock>(null)
  const shot = frameFor('elbow', side)
  const seeded = useRef(false)
  if (!seeded.current) {
    writeArm(poseRef.current, poseFromAngles(READY_ANGLES, side))
    seeded.current = true
  }

  const onBones = useCallback((next: ArmBones) => setBones(next), [])

  function writeAngles(next: JointAngles, nextSide: Side = side) {
    setAngles(next)
    writeArm(poseRef.current, poseFromAngles(next, nextSide))
  }

  function pullFromBone() {
    if (!bones) return
    const key = LOCK[selected]
    const bone = bones[key]
    const dst = poseRef.current[key]
    dst[0] = bone.quaternion.x
    dst[1] = bone.quaternion.y
    dst[2] = bone.quaternion.z
    dst[3] = bone.quaternion.w
    setAngles(anglesFromArm(poseRef.current, side))
  }

  return (
    <TestPage
      kicker="Cursor"
      title="Manual pose"
      lede="Sliders and the rotation gizmo write the same quaternions. Save Target stores this pose for the ghost comparison page."
      note="Click a joint, then drag the gizmo. Red X, green Y, blue Z."
      panel={
        <div className="stack">
          <div className="row">
            <button type="button" className={side === 'right' ? 'btn primary' : 'btn'} onClick={() => { setSide('right'); writeAngles(angles, 'right') }}>
              Right
            </button>
            <button type="button" className={side === 'left' ? 'btn primary' : 'btn'} onClick={() => { setSide('left'); writeAngles(angles, 'left') }}>
              Left
            </button>
          </div>
          <div className="row">
            {(['shoulder', 'elbow', 'wrist'] as JointId[]).map((joint) => (
              <button key={joint} type="button" className={selected === joint ? 'btn primary' : 'btn'} onClick={() => setSelected(joint)}>
                {joint}
              </button>
            ))}
          </div>
          <Slider label="Shoulder flexion" min={-20} max={160} value={angles.shoulderFlexion} onChange={(value) => writeAngles({ ...angles, shoulderFlexion: value })} />
          <Slider label="Shoulder abduction" min={0} max={150} value={angles.shoulderAbduction} onChange={(value) => writeAngles({ ...angles, shoulderAbduction: value })} />
          <Slider label="Elbow flexion" min={0} max={150} value={angles.elbowFlexion} onChange={(value) => writeAngles({ ...angles, elbowFlexion: value })} />
          <Slider label="Wrist flexion" min={-60} max={70} value={angles.wristFlexion} onChange={(value) => writeAngles({ ...angles, wristFlexion: value })} />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => saveTarget(angles)}>
              Save target
            </button>
            <button type="button" className="btn" onClick={() => writeAngles(READY_ANGLES)}>
              Reset
            </button>
          </div>
          <p>{hasCustomTarget ? 'A target is saved for the ghost page.' : 'No saved target yet.'}</p>
          <h2>Quaternions</h2>
          <p className="mono">upper {qText(poseRef.current.upper)}</p>
          <p className="mono">fore {qText(poseRef.current.fore)}</p>
          <p className="mono">hand {qText(poseRef.current.hand)}</p>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look} onMiss={() => setSelected('elbow')}>
        <Humanoid
          key={side}
          side={side}
          poseRef={poseRef}
          slerp={1}
          selected={selected}
          onSelect={setSelected}
          onBones={onBones}
          lockRef={lockRef}
          showSensors
        />
        {bones ? (
          <RotateGizmo
            bone={bones[LOCK[selected]]}
            onChange={pullFromBone}
            onDrag={(dragging) => {
              lockRef.current = dragging ? LOCK[selected] : null
            }}
          />
        ) : null}
        <GlideCamera cam={shot.cam} look={shot.look} token={`${side}`} />
      </Scene>
    </TestPage>
  )
}
