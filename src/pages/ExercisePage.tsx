import { useEffect, useState } from 'react'
import { focusKey, legDriveFor, muscleHighlight, peakFocus, sampleExercise } from '../motion/exercises.ts'
import { poseFromAngles } from '../motion/quat.ts'
import { REST_ANGLES, type Exercise, type JointAngles } from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { allExercises } from '../product/catalog.ts'
import { useRehab } from '../store/rehabStore.ts'
import { Choice, RomBar, SideToggle, TestPage } from '../ui/widgets.tsx'

export function ExercisePage() {
  const side = useRehab((state) => state.side)
  const custom = useRehab((state) => state.customExercise)
  const saved = useRehab((state) => state.savedExercises)
  const options = allExercises(custom ? [custom, ...saved] : saved)
  const [id, setId] = useState(options[0].id)
  const exercise = options.find((item) => item.id === id) ?? options[0]
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState('1')
  const [time, setTime] = useState(0)
  const [angles, setAngles] = useState<JointAngles>(exercise.keyframes[0]?.angles ?? REST_ANGLES)
  const shot = frameFor(exercise.focus, side)
  const sim = useSim((t) => {
    const next = sampleExercise(exercise, t)
    return { arm: poseFromAngles(next, side), angles: next }
  }, poseFromAngles(exercise.keyframes[0]?.angles ?? REST_ANGLES, side))
  sim.playingRef.current = playing
  sim.speedRef.current = Number(speed)
  sim.onHudRef.current = (frame, t) => {
    setTime(t)
    setAngles(frame.angles)
  }

  useEffect(() => {
    sim.timeRef.current = 0
    setTime(0)
  }, [exercise.id, sim.timeRef])

  const key = focusKey(exercise)
  const highlight = muscleHighlight(exercise)
  const clock = ((time % exercise.duration) + exercise.duration) % exercise.duration

  return (
    <TestPage
      kicker="Keyframes"
      title="Exercise playback"
      lede="The avatar plays a saved exercise. The camera moves in on the joint that exercise is about, and the arc shows current flexion against the peak target."
      note={`${exercise.name} · ${speed}×`}
      panel={
        <div className="stack">
          <Choice
            value={exercise.id}
            options={options.map((item) => ({ id: item.id, label: item.name }))}
            onChange={setId}
          />
          <SideToggle />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => setPlaying((value) => !value)}>
              {playing ? 'Pause' : 'Play'}
            </button>
          </div>
          <Choice
            value={speed}
            options={[
              { id: '0.25', label: '0.25×' },
              { id: '0.5', label: '0.5×' },
              { id: '1', label: '1×' },
            ]}
            onChange={setSpeed}
          />
          <label className="slider">
            <span className="slider-top">
              <span>Timeline</span>
              <span className="mono">
                {clock.toFixed(2)}s / {exercise.duration.toFixed(0)}s
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={exercise.duration}
              step={0.01}
              value={clock}
              onChange={(event) => {
                sim.playingRef.current = false
                setPlaying(false)
                sim.timeRef.current = Number(event.target.value)
                setTime(sim.timeRef.current)
              }}
            />
          </label>
          <h2>Primary movement region</h2>
          <p>{exercise.region}. This is a visual guide, not a muscle-activation reading.</p>
          <RomBar min={0} max={150} value={angles[key]} target={peakFocus(exercise)} limitMax={exercise.limit.max} />
          <p>
            {labelFor(exercise)} {angles[key].toFixed(1)}°. Configured limit {exercise.limit.min}–{exercise.limit.max}°.
          </p>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look}>
        <Humanoid
          key={side}
          side={side}
          poseRef={sim.poseRef}
          slerp={0.25}
          rom={{ target: peakFocus(exercise) }}
          highlight={highlight}
          legDrive={legDriveFor(exercise)}
        />
        <GlideCamera cam={shot.cam} look={shot.look} token={`${exercise.id}-${side}`} />
      </Scene>
    </TestPage>
  )
}

function labelFor(exercise: Exercise) {
  if (exercise.focus === 'elbow') return 'Elbow flexion'
  if (exercise.focus === 'shoulder') return 'Shoulder'
  if (exercise.focus === 'hip') return 'Hip'
  if (exercise.focus === 'knee') return 'Knee flexion'
  if (exercise.focus === 'ankle') return 'Ankle'
  return 'Wrist flexion'
}
