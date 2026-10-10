import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as THREE from 'three'
import { exerciseIdFromName, generateExerciseFromPrompt } from '../../ai/generateExercise.ts'
import { legDriveFor, regionFor, sampleExercise } from '../../motion/exercises.ts'
import { solveArmIk } from '../../motion/ik.ts'
import { anglesFromArm, poseFromAngles } from '../../motion/quat.ts'
import { READY_ANGLES, REST_ANGLES, createArm, isLegFocus, writeArm, type Exercise, type ExerciseFocus, type JointAngles, type JointId } from '../../motion/types.ts'
import { useSim } from '../../motion/useMotionLoop.ts'
import { frameFor } from '../../rig/cameras.ts'
import { Humanoid, type ArmBones, type BoneLock } from '../../rig/Humanoid.tsx'
import { SHOULDER } from '../../rig/layout.ts'
import { GlideCamera, Scene } from '../../rig/Scene.tsx'
import { useRehab } from '../../store/rehabStore.ts'
import { InfoTip } from '../../ui/InfoTip.tsx'
import { Choice, Slider } from '../../ui/widgets.tsx'

type Frame = { time: number; angles: JointAngles }
type ArmJoint = Extract<JointId, 'shoulder' | 'elbow' | 'wrist'>
const LOCK: Record<ArmJoint, Exclude<BoneLock, null>> = { shoulder: 'upper', elbow: 'fore', wrist: 'hand' }
const JOINTS: JointId[] = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle']

function isArmJoint(joint: JointId): joint is ArmJoint {
  return joint === 'shoulder' || joint === 'elbow' || joint === 'wrist'
}

export function BuilderPage() {
  const side = useRehab((state) => state.side)
  const upsertExercise = useRehab((state) => state.upsertExercise)
  const patients = useRehab((state) => state.patients)
  const assignExerciseToPatient = useRehab((state) => state.assignExerciseToPatient)
  const setViewerMode = useRehab((state) => state.setViewerMode)
  const [params] = useSearchParams()
  useEffect(() => { setViewerMode('clinician') }, [setViewerMode])
  const [name, setName] = useState('Custom reach')
  const [exerciseId, setExerciseId] = useState('custom')
  const [purpose, setPurpose] = useState('A custom movement saved by a clinician.')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [assignPatientId, setAssignPatientId] = useState(params.get('patient') ?? '')
  const [focus, setFocus] = useState<ExerciseFocus>('elbow')
  const [laterality, setLaterality] = useState<'uni' | 'bi'>('uni')
  const [method, setMethod] = useState<'joints' | 'drag'>('joints')
  const [reps, setReps] = useState(8)
  const [hold, setHold] = useState(2)
  const [tolerance, setTolerance] = useState(12)
  const [frames, setFrames] = useState<Frame[]>([
    { time: 0, angles: { ...REST_ANGLES, shoulderAbduction: 12, elbowFlexion: 5 } },
    { time: 2, angles: { ...REST_ANGLES, shoulderAbduction: 12, elbowFlexion: 90 } },
  ])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<JointId>('elbow')
  const [playing, setPlaying] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cues, setCues] = useState('')
  const [bones, setBones] = useState<ArmBones | null>(null)
  const [angles, setAngles] = useState<JointAngles>(READY_ANGLES)
  const poseRef = useRef(createArm(poseFromAngles(READY_ANGLES, side)))
  const lockRef = useRef<BoneLock>(null)
  const framesRef = useRef(frames)
  const playingRef = useRef(playing)
  const indexRef = useRef(index)
  const focusRef = useRef(focus)
  const lateralityRef = useRef(laterality)
  const nameRef = useRef(name)
  const repsRef = useRef(reps)
  const holdRef = useRef(hold)
  const toleranceRef = useRef(tolerance)
  framesRef.current = frames
  playingRef.current = playing
  indexRef.current = index
  focusRef.current = focus
  lateralityRef.current = laterality
  nameRef.current = name
  repsRef.current = reps
  holdRef.current = hold
  toleranceRef.current = tolerance
  const previewCamera = isLegFocus(focus) && laterality === 'bi' ? 'lower' : focus
  const shot = frameFor(previewCamera, side)

  const sim = useSim((time) => {
    if (playingRef.current) {
      const exercise = toExercise(
        nameRef.current,
        focusRef.current,
        framesRef.current,
        repsRef.current,
        holdRef.current,
        toleranceRef.current,
        lateralityRef.current,
      )
      const next = sampleExercise(exercise, time)
      return { arm: poseFromAngles(next, side), angles: next }
    }
    const current = framesRef.current[indexRef.current]?.angles ?? REST_ANGLES
    return { arm: poseFromAngles(current, side), angles: current }
  }, poseFromAngles(READY_ANGLES, side), false)
  sim.playingRef.current = playing
  sim.onHudRef.current = (frame) => {
    setAngles(frame.angles)
  }

  function writeAngles(next: JointAngles) {
    setPlaying(false)
    setAngles(next)
    writeArm(poseRef.current, poseFromAngles(next, side))
    setFrames((prev) => {
      const updated = prev.map((frame, frameIndex) => (frameIndex === index ? { ...frame, angles: next } : frame))
      framesRef.current = updated
      return updated
    })
  }

  function pullFromBone() {
    if (!bones || !isArmJoint(selected)) return
    const key = LOCK[selected]
    const bone = bones[key]
    const dst = poseRef.current[key]
    dst[0] = bone.quaternion.x
    dst[1] = bone.quaternion.y
    dst[2] = bone.quaternion.z
    dst[3] = bone.quaternion.w
    const next = anglesFromArm(poseRef.current, side)
    setAngles(next)
    setFrames((prev) => prev.map((frame, frameIndex) => (frameIndex === indexRef.current ? { ...frame, angles: next } : frame)))
  }

  const onBones = useCallback((next: ArmBones) => setBones(next), [])

  async function generate() {
    setGenerating(true)
    setGenError(null)
    setSaved(false)
    try {
      const exercise = await generateExerciseFromPrompt(prompt)
      applyExercise(exercise)
      setPlaying(true)
      sim.timeRef.current = 0
    } catch (error) {
      setGenError(error instanceof Error ? error.message : 'Could not generate that exercise.')
    } finally {
      setGenerating(false)
    }
  }

  function applyExercise(exercise: Exercise) {
    setExerciseId(exercise.id)
    setName(exercise.name)
    nameRef.current = exercise.name
    setPurpose(exercise.purpose || 'A custom movement saved by a clinician.')
    setCues(exercise.cues ?? '')
    setFocus(exercise.focus)
    focusRef.current = exercise.focus
    const nextLaterality = exercise.laterality === 'bi' ? 'bi' : 'uni'
    setLaterality(nextLaterality)
    lateralityRef.current = nextLaterality
    setReps(exercise.reps ?? 8)
    setHold(exercise.hold ?? 2)
    setTolerance(exercise.tolerance ?? 12)
    const nextFrames = exercise.keyframes.map((frame) => ({ time: frame.time, angles: { ...frame.angles } }))
    setFrames(nextFrames)
    framesRef.current = nextFrames
    setIndex(0)
    indexRef.current = 0
    setSelected(exercise.focus)
    setMethod(isLegFocus(exercise.focus) ? 'joints' : method)
    const start = nextFrames[0]?.angles ?? READY_ANGLES
    setAngles(start)
    writeArm(poseRef.current, poseFromAngles(start, side))
  }

  function assignCurrent() {
    const id = exerciseId === 'custom' ? exerciseIdFromName(name) : exerciseId
    const exercise = { ...toExercise(name, focus, frames, reps, hold, tolerance, laterality), id, purpose, cues: cues || undefined }
    setExerciseId(id)
    upsertExercise(exercise)
    if (assignPatientId) assignExerciseToPatient(assignPatientId, id)
    setSaved(true)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Clinician</p>
          <h1>Exercise builder</h1>
        </div>
        <Link to={`/exercises/${exerciseId}`} className="ghost-btn">Preview in library</Link>
      </header>
      <section className="sticker prompt-bubble">
        <div className="heading-row">
          <p className="kicker">Describe it</p>
          <InfoTip label="How generation works">
            <p>Gemini turns the prompt into full-body keyframes (shoulder through ankle). The 3D preview plays those frames on the matching region — a squat should bend both hips and knees, not lift an arm. Edit poses if needed, then assign. It is a movement demo, not a treatment prescription.</p>
          </InfoTip>
        </div>
        <h2>Generate an exercise from plain language</h2>
        <p className="quiet">Examples: “Lower-body squats, 8 reps, sit the hips back to about 90° of knee bend.” · “Seated elbow curls, 10 reps, bend to 90°, keep the upper arm still.”</p>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Type the movement you want the patient to practice…"
          rows={3}
        />
        <div className="row">
          <button
            type="button"
            className="candy"
            disabled={generating || prompt.trim().length < 8}
            onClick={() => void generate()}
          >
            {generating ? 'Generating…' : 'Generate exercise'}
          </button>
          {playing ? <span className="charge-pill full">Previewing</span> : null}
        </div>
        {genError ? <p className="attention">{genError}</p> : null}
        {purpose && exerciseId !== 'custom' ? <p className="quiet">{purpose}{cues ? ` ${cues}` : ''}</p> : null}
      </section>
      <div className="session-layout">
        <div className="stage">
          <Scene camera={shot.cam} look={shot.look}>
            <Humanoid
              key={`${side}-${focus}-${laterality}`}
              side={side}
              poseRef={sim.poseRef}
              slerp={method === 'drag' || playing ? 0.28 : 1}
              selected={method === 'joints' ? selected : null}
              onSelect={method === 'joints' ? setSelected : undefined}
              onBones={onBones}
              lockRef={lockRef}
              legDrive={legDriveFor({ focus, laterality })}
            />
            {method === 'joints' && bones && !playing && isArmJoint(selected) ? (
              <RotateGizmo
                bone={bones[LOCK[selected]]}
                onChange={pullFromBone}
                onDrag={(dragging) => {
                  lockRef.current = dragging ? LOCK[selected] : null
                }}
              />
            ) : null}
            {method === 'drag' && !playing && !isLegFocus(focus) ? (
              <DragHandle
                side={side}
                onSolve={(arm) => {
                  writeArm(poseRef.current, arm)
                  const next = anglesFromArm(arm, side)
                  setAngles(next)
                  setFrames((prev) => prev.map((frame, frameIndex) => (frameIndex === indexRef.current ? { ...frame, angles: next } : frame)))
                }}
              />
            ) : null}
            <GlideCamera cam={shot.cam} look={shot.look} token={`${previewCamera}-${side}-${laterality}`} />
          </Scene>
          <div className="float-chip">
            {playing ? `Preview · ${name}` : method === 'drag' ? 'Drag the wrist' : `Posing ${selected}`}
          </div>
        </div>
        <aside className="panel">
          <label className="field">Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <Choice
            value={focus}
            onChange={(value) => {
              setFocus(value)
              if (value === 'knee' || value === 'ankle') setLaterality(/squat|heel/i.test(name) ? 'bi' : 'uni')
              else if (value === 'hip') setLaterality('uni')
            }}
            options={[
              { id: 'elbow', label: 'Elbow' },
              { id: 'shoulder', label: 'Shoulder' },
              { id: 'wrist', label: 'Wrist' },
              { id: 'hip', label: 'Hip' },
              { id: 'knee', label: 'Knee' },
              { id: 'ankle', label: 'Ankle' },
            ]}
          />
          {isLegFocus(focus) ? (
            <Choice
              value={laterality}
              onChange={setLaterality}
              options={[
                { id: 'uni', label: 'One leg' },
                { id: 'bi', label: 'Both legs' },
              ]}
            />
          ) : null}
          <h2>Pose method</h2>
          <Choice
            value={method}
            onChange={setMethod}
            options={[{ id: 'joints', label: 'Joint rotation' }, { id: 'drag', label: 'Drag body' }]}
          />
          {method === 'joints' ? (
            <>
              <div className="row">
                {JOINTS.map((joint) => (
                  <button key={joint} type="button" className={selected === joint ? 'candy' : 'ghost-btn'} onClick={() => setSelected(joint)}>{joint}</button>
                ))}
              </div>
              <Slider label="Shoulder flexion" min={-20} max={160} value={angles.shoulderFlexion} onChange={(value) => writeAngles({ ...angles, shoulderFlexion: value })} />
              <Slider label="Shoulder abduction" min={0} max={150} value={angles.shoulderAbduction} onChange={(value) => writeAngles({ ...angles, shoulderAbduction: value })} />
              <Slider label="Elbow" min={0} max={150} value={angles.elbowFlexion} onChange={(value) => writeAngles({ ...angles, elbowFlexion: value })} />
              <Slider label="Wrist" min={-60} max={70} value={angles.wristFlexion} onChange={(value) => writeAngles({ ...angles, wristFlexion: value })} />
              <Slider label="Hip flexion" min={-10} max={120} value={angles.hipFlexion} onChange={(value) => writeAngles({ ...angles, hipFlexion: value })} />
              <Slider label="Hip abduction" min={0} max={50} value={angles.hipAbduction} onChange={(value) => writeAngles({ ...angles, hipAbduction: value })} />
              <Slider label="Knee" min={0} max={140} value={angles.kneeFlexion} onChange={(value) => writeAngles({ ...angles, kneeFlexion: value })} />
              <Slider label="Ankle" min={-40} max={40} value={angles.ankleFlexion} onChange={(value) => writeAngles({ ...angles, ankleFlexion: value })} />
            </>
          ) : (
            <p>{isLegFocus(focus) ? 'Drag-to-pose is for the arm. Use the joint sliders for hips, knees, and ankles.' : 'Grab the blue target. The arm bends to reach it, then you can save that pose.'}</p>
          )}
          <h2>Keyframes</h2>
          <div className="frame-list">
            {frames.map((frame, frameIndex) => (
              <button key={`${frame.time}-${frameIndex}`} type="button" className={frameIndex === index ? 'on' : ''} onClick={() => { setPlaying(false); setIndex(frameIndex); setAngles(frame.angles); writeArm(poseRef.current, poseFromAngles(frame.angles, side)) }}>
                {frame.time.toFixed(1)}s · {focus} {Math.round(
                  focus === 'hip' ? frame.angles.hipFlexion : focus === 'knee' ? frame.angles.kneeFlexion : focus === 'ankle' ? frame.angles.ankleFlexion : focus === 'shoulder' ? frame.angles.shoulderFlexion : focus === 'wrist' ? frame.angles.wristFlexion : frame.angles.elbowFlexion,
                )}°
              </button>
            ))}
          </div>
          <div className="row">
            <button type="button" className="ghost-btn" onClick={() => {
              const last = frames[frames.length - 1]
              setFrames((prev) => [...prev, { time: Number((last.time + 1.5).toFixed(1)), angles: { ...angles } }])
              setIndex(frames.length)
            }}>Add keyframe</button>
            <button type="button" className="candy" onClick={() => { setPlaying((value) => !value); if (!playing) sim.timeRef.current = 0 }}>{playing ? 'Stop preview' : 'Preview'}</button>
          </div>
          <Slider label="Repetitions" min={4} max={20} value={reps} onChange={setReps} unit="" />
          <Slider label="Hold" min={0} max={5} value={hold} onChange={setHold} unit="s" />
          <Slider label="Match tolerance" min={5} max={25} value={tolerance} onChange={setTolerance} unit="°" />
          <label className="field">
            Assign to patient
            <select value={assignPatientId} onChange={(event) => setAssignPatientId(event.target.value)}>
              <option value="">Library only</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>{patient.name} ({patient.code})</option>
              ))}
            </select>
          </label>
          <button type="button" className="candy" onClick={assignCurrent}>
            {assignPatientId ? 'Save and assign' : 'Save to library'}
          </button>
          {saved ? (
            <p>
              Saved{assignPatientId ? ` and assigned to ${patients.find((patient) => patient.id === assignPatientId)?.name ?? 'the patient'}` : ' to the library'}.
              {' '}<Link to={`/exercises/${exerciseId}`}>Preview</Link>
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function toExercise(name: string, focus: ExerciseFocus, frames: Frame[], reps: number, hold: number, tolerance: number, laterality: 'uni' | 'bi' = 'uni'): Exercise {
  const ordered = [...frames].sort((a, b) => a.time - b.time)
  return {
    id: 'custom',
    name: name.trim() || 'Custom exercise',
    purpose: 'A custom movement saved by a clinician.',
    duration: Math.max(0.5, ordered[ordered.length - 1]?.time ?? 1),
    focus,
    region: regionFor(focus),
    laterality: isLegFocus(focus) ? laterality : 'uni',
    limit: { min: 0, max: 130 },
    reps,
    hold,
    tolerance,
    keyframes: ordered.map((frame) => ({ time: frame.time, angles: { ...frame.angles } })),
  }
}

function RotateGizmo({ bone, onChange, onDrag }: { bone: THREE.Object3D; onChange: () => void; onDrag: (dragging: boolean) => void }) {
  const controls = useThree((state) => state.controls) as { enabled?: boolean } | null
  const changeRef = useRef(onChange)
  const dragRef = useRef(onDrag)
  const controlsRef = useRef(controls)
  changeRef.current = onChange
  dragRef.current = onDrag
  controlsRef.current = controls
  const down = useCallback(() => { dragRef.current(true); if (controlsRef.current) controlsRef.current.enabled = false }, [])
  const up = useCallback(() => { changeRef.current(); dragRef.current(false); if (controlsRef.current) controlsRef.current.enabled = true }, [])
  const change = useCallback(() => changeRef.current(), [])
  return <TransformControls object={bone} mode="rotate" space="local" size={0.7} onMouseDown={down} onMouseUp={up} onObjectChange={change} />
}

function DragHandle({ side, onSolve }: { side: 'right' | 'left'; onSolve: (arm: ReturnType<typeof poseFromAngles>) => void }) {
  const meshRef = useRef<THREE.Mesh>(null)
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
    solveRef.current(solveArmIk(mesh.position, side).arm)
  }, [side, start])
  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.045, 18, 18]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#5b21b6" emissiveIntensity={0.35} />
      </mesh>
      <TransformControls
        object={meshRef as RefObject<THREE.Object3D>}
        mode="translate"
        size={0.7}
        onMouseDown={() => { if (controlsRef.current) controlsRef.current.enabled = false }}
        onMouseUp={() => { if (controlsRef.current) controlsRef.current.enabled = true }}
        onObjectChange={() => { if (meshRef.current) solveRef.current(solveArmIk(meshRef.current.position, side).arm) }}
      />
    </>
  )
}
