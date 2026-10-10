import { useEffect, useRef, useState } from 'react'
import { EXERCISES, focusKey, legDriveFor, muscleHighlight, peakFocus, sampleExercise, samplePatient } from '../motion/exercises.ts'
import { errorColor, poseFromAngles, segmentErrors } from '../motion/quat.ts'
import { createRepCounter, scoreWindow, type ScoreParts } from '../motion/scoring.ts'
import { REST_ANGLES, type Exercise, type JointAngles } from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid, type SegmentColors } from '../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { Choice, RomBar, ScoreBar, Slider, Stat, TestPage } from '../ui/widgets.tsx'

const emptyScore: ScoreParts = { range: 100, accuracy: 100, smoothness: 100, compensation: 100, total: 100 }

function bands(exercise: Exercise) {
  const key = focusKey(exercise)
  const start = exercise.keyframes[0]?.angles[key] ?? 0
  const peak = peakFocus(exercise)
  return { high: start + (peak - start) * 0.72, low: start + (peak - start) * 0.28 }
}

export function DashboardPage() {
  const side = useRehab((state) => state.side)
  const setLastScore = useRehab((state) => state.setLastScore)
  const [id, setId] = useState(EXERCISES[0].id)
  const exercise = EXERCISES.find((item) => item.id === id) ?? EXERCISES[0]
  const [noise, setNoise] = useState(2)
  const [compensation, setCompensation] = useState(16)
  const [hud, setHud] = useState({
    angles: exercise.keyframes[0]?.angles ?? REST_ANGLES,
    ideal: exercise.keyframes[0]?.angles ?? REST_ANGLES,
    velocity: 0,
    reps: 0,
    score: emptyScore,
    cheat: 0,
    colors: {} as SegmentColors,
  })
  const exerciseRef = useRef(exercise)
  const noiseRef = useRef(noise)
  const compRef = useRef(compensation)
  const history = useRef<{ patient: JointAngles; ideal: JointAngles }[]>([])
  const reps = useRef(createRepCounter(() => bands(exerciseRef.current)))
  const prev = useRef({ t: 0, value: 0 })
  exerciseRef.current = exercise
  noiseRef.current = noise
  compRef.current = compensation

  const sim = useSim((time) => {
    const current = exerciseRef.current
    const ideal = sampleExercise(current, time)
    const patient = samplePatient(current, time, { lag: 0.08, noise: noiseRef.current, compensation: compRef.current })
    return { arm: poseFromAngles(patient, side), patient, ideal }
  }, poseFromAngles(exercise.keyframes[0]?.angles ?? REST_ANGLES, side))

  sim.onFrameRef.current = (frame) => {
    const key = focusKey(exerciseRef.current)
    reps.current.push(frame.patient[key])
    history.current.push({ patient: frame.patient, ideal: frame.ideal })
    if (history.current.length > 200) history.current.shift()
  }
  sim.onHudRef.current = (frame, t) => {
    const key = focusKey(exerciseRef.current)
    const dt = t - prev.current.t
    const velocity = dt > 0.02 ? (frame.patient[key] - prev.current.value) / dt : hudVelocity(frame.patient[key], prev.current.value, dt)
    prev.current = { t, value: frame.patient[key] }
    const score = scoreWindow(history.current, exerciseRef.current, reps.current.peak())
    const errors = segmentErrors(poseFromAngles(frame.patient, side), poseFromAngles(frame.ideal, side))
    const cheat = cheatAmount(exerciseRef.current, frame.patient, frame.ideal)
    setLastScore(score.total)
    setHud({
      angles: frame.patient,
      ideal: frame.ideal,
      velocity,
      reps: reps.current.reps(),
      score,
      cheat,
      colors: {
        upper: exerciseRef.current.focus === 'elbow' && cheat > 10 ? '#e39a3a' : errorColor(errors.upper),
        fore: errorColor(errors.fore),
        hand: errorColor(errors.hand),
      },
    })
  }

  useEffect(() => {
    history.current = []
    reps.current.reset()
    prev.current = { t: 0, value: 0 }
    sim.timeRef.current = 0
  }, [exercise.id, sim.timeRef])

  const key = focusKey(exercise)
  const shot = frameFor(exercise.focus, side)
  const highlight = muscleHighlight(exercise)
  const cheating = hud.cheat > 10

  return (
    <TestPage
      kicker="Score"
      title="Dashboard"
      lede="Reps, speed, and a form score come from the built-in patient. The score is 30% range, 30% accuracy, 20% smoothness, 20% compensation. Limits here are exercise settings, not clinical safety limits."
      note={cheating ? 'Excess proximal movement' : 'Within compensation band'}
      panel={
        <div className="stack">
          <Choice value={exercise.id} options={EXERCISES.map((item) => ({ id: item.id, label: item.name }))} onChange={setId} />
          <Slider label="Noise" min={0} max={14} value={noise} onChange={setNoise} unit="°" />
          <Slider label="Compensation" min={0} max={35} value={compensation} onChange={setCompensation} unit="°" />
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.current = []
              reps.current.reset()
            }}
          >
            Reset reps and score
          </button>
          <Stat label="Reps" value={String(hud.reps)} />
          <Stat label="Focus angle" value={`${hud.angles[key].toFixed(1)}°`} hint={`Target peak ${peakFocus(exercise).toFixed(0)}°`} />
          <Stat label="Velocity" value={`${hud.velocity.toFixed(0)}°/s`} />
          <RomBar min={0} max={150} value={hud.angles[key]} target={peakFocus(exercise)} limitMax={exercise.limit.max} />
          <h2>Form score {hud.score.total}</h2>
          <ScoreBar value={hud.score.total} />
          <Stat label="Range" value={String(hud.score.range)} />
          <Stat label="Accuracy" value={String(hud.score.accuracy)} />
          <Stat label="Smoothness" value={String(hud.score.smoothness)} />
          <Stat label="Compensation" value={String(hud.score.compensation)} tone={cheating ? 'warn' : 'ok'} />
          <div className="formula">S = 0.30 R + 0.30 A + 0.20 V + 0.20 C</div>
          <h2>Primary movement region</h2>
          <p>{exercise.region}</p>
          {cheating ? (
            <p>
              Expected extra {exercise.focus === 'shoulder' ? 'elbow' : 'shoulder'} movement under 10°. Observed{' '}
              {hud.cheat.toFixed(0)}°.
            </p>
          ) : (
            <p>Compensation is inside the 10° band.</p>
          )}
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look}>
        <Humanoid
          key={side}
          side={side}
          poseRef={sim.poseRef}
          slerp={0.22}
          colors={hud.colors}
          highlight={highlight}
          rom={{ target: peakFocus(exercise) }}
          legDrive={legDriveFor(exercise)}
        />
        <GlideCamera cam={shot.cam} look={shot.look} token={`${exercise.id}-${side}`} />
      </Scene>
    </TestPage>
  )
}

function cheatAmount(exercise: Exercise, patient: JointAngles, ideal: JointAngles) {
  if (exercise.focus === 'elbow') return Math.abs(patient.shoulderFlexion - ideal.shoulderFlexion)
  if (exercise.focus === 'hip') return Math.abs((patient.kneeFlexion ?? 0) - (ideal.kneeFlexion ?? 0))
  if (exercise.focus === 'knee' || exercise.focus === 'ankle') {
    return Math.abs((patient.hipFlexion ?? 0) - (ideal.hipFlexion ?? 0))
  }
  return Math.abs(patient.elbowFlexion - ideal.elbowFlexion)
}

function hudVelocity(value: number, previous: number, dt: number) {
  if (dt <= 0) return 0
  return (value - previous) / dt
}
