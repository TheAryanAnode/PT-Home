import { useRef, useState } from 'react'
import { EXERCISES, focusKey, sampleExercise, samplePatient } from '../motion/exercises.ts'
import { errorColor, matchPercent, poseFromAngles, segmentErrors } from '../motion/quat.ts'
import { createArm, writeArm, type JointAngles } from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { CAM, frameFor } from '../rig/cameras.ts'
import { Humanoid, type SegmentColors } from '../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { Choice, ScoreBar, Slider, TestPage } from '../ui/widgets.tsx'

const exercise = EXERCISES[0]

export function GhostPage() {
  const side = useRehab((state) => state.side)
  const targetAngles = useRehab((state) => state.targetAngles)
  const hasCustomTarget = useRehab((state) => state.hasCustomTarget)
  const clearTarget = useRehab((state) => state.clearTarget)
  const [layout, setLayout] = useState<'overlay' | 'beside'>('overlay')
  const [source, setSource] = useState<'follow' | 'saved'>('follow')
  const [lag, setLag] = useState(0.35)
  const [noise, setNoise] = useState(2)
  const [compensation, setCompensation] = useState(0)
  const ghostRef = useRef(createArm())
  const [hud, setHud] = useState({
    match: 100,
    errors: { upper: 0, fore: 0, hand: 0 },
    colors: {} as SegmentColors,
    patient: targetAngles,
    ideal: targetAngles,
  })

  const sim = useSim((time) => {
    const ideal = source === 'saved' ? targetAngles : sampleExercise(exercise, time)
    const patient = samplePatient(exercise, time, {
      lag: source === 'saved' ? 0.1 : lag,
      noise,
      compensation: source === 'saved' ? 10 : compensation,
    })
    const targetArm = poseFromAngles(ideal, side)
    const arm = poseFromAngles(patient, side)
    return { arm, targetArm, patient, ideal, errors: segmentErrors(arm, targetArm), match: matchPercent(arm, targetArm) }
  }, poseFromAngles(sampleExercise(exercise, 0), side))
  sim.onFrameRef.current = (frame) => {
    writeArm(ghostRef.current, frame.targetArm)
  }
  sim.onHudRef.current = (frame) => {
    setHud({
      match: frame.match,
      errors: frame.errors,
      patient: frame.patient,
      ideal: frame.ideal,
      colors: {
        upper: errorColor(frame.errors.upper),
        fore: errorColor(frame.errors.fore),
        hand: errorColor(frame.errors.hand),
      },
    })
  }

  const shot = layout === 'beside' ? CAM.wide : frameFor('body', side)
  const focus = focusKey(exercise)

  return (
    <TestPage
      kicker="Form"
      title="Ghost target"
      lede="The blue figure is the target. The solid figure is the patient. Segment color is the angle between their quaternions: green under 5°, yellow under 15°, red after that."
      note={source === 'saved' ? 'Saved target' : 'Following the exercise'}
      panel={
        <div className="stack">
          <Choice
            value={source}
            options={[
              { id: 'follow', label: 'Follow exercise' },
              { id: 'saved', label: 'Saved target' },
            ]}
            onChange={setSource}
          />
          <Choice
            value={layout}
            options={[
              { id: 'overlay', label: 'Overlay' },
              { id: 'beside', label: 'Side by side' },
            ]}
            onChange={setLayout}
          />
          {source === 'follow' ? (
            <>
              <Slider label="Lag" min={0} max={0.8} step={0.05} value={lag} onChange={setLag} unit="s" />
              <Slider label="Noise" min={0} max={12} value={noise} onChange={setNoise} unit="°" />
              <Slider label="Shoulder cheat" min={0} max={30} value={compensation} onChange={setCompensation} unit="°" />
            </>
          ) : (
            <p>
              {hasCustomTarget
                ? 'Using the pose saved from Manual pose.'
                : 'Using the built-in 90° elbow target. Save one from Manual pose to replace it.'}
            </p>
          )}
          {source === 'saved' && hasCustomTarget ? (
            <button type="button" className="btn" onClick={clearTarget}>
              Clear saved target
            </button>
          ) : null}
          <h2>Match {hud.match}%</h2>
          <ScoreBar value={hud.match} />
          <p>Upper arm {hud.errors.upper.toFixed(1)}°</p>
          <p>Forearm {hud.errors.fore.toFixed(1)}°</p>
          <p>Hand {hud.errors.hand.toFixed(1)}°</p>
          <p>
            Patient {label(focus)} {hud.patient[focus].toFixed(0)}° · target {hud.ideal[focus].toFixed(0)}°
          </p>
          <div className="legend">
            <span><i className="swatch" style={{ background: '#3ecf8e' }} />0–5°</span>
            <span><i className="swatch" style={{ background: '#e6b325' }} />5–15°</span>
            <span><i className="swatch" style={{ background: '#e85d4c' }} />over 15°</span>
          </div>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look}>
        <Humanoid
          side={side}
          poseRef={ghostRef}
          ghost
          slerp={0.2}
          position={layout === 'beside' ? [-0.7, 0, 0] : [0, 0, 0]}
          label={layout === 'beside' ? 'Target' : undefined}
        />
        <Humanoid
          side={side}
          poseRef={sim.poseRef}
          slerp={0.2}
          colors={hud.colors}
          position={layout === 'beside' ? [0.7, 0, 0] : [0, 0, 0]}
          label={layout === 'beside' ? 'Patient' : undefined}
        />
        <GlideCamera cam={shot.cam} look={shot.look} token={`${layout}-${side}`} />
      </Scene>
    </TestPage>
  )
}

function label(key: keyof JointAngles) {
  if (key === 'elbowFlexion') return 'elbow'
  if (key === 'shoulderAbduction') return 'abduction'
  if (key === 'shoulderFlexion') return 'shoulder flexion'
  if (key === 'hipFlexion') return 'hip flexion'
  if (key === 'hipAbduction') return 'hip abduction'
  if (key === 'kneeFlexion') return 'knee'
  if (key === 'ankleFlexion') return 'ankle'
  return 'wrist'
}
