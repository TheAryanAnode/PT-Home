import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { focusKey, legDriveFor, muscleHighlight, peakFocus, sampleExercise } from '../../motion/exercises.ts'
import { poseFromAngles } from '../../motion/quat.ts'
import { REST_ANGLES } from '../../motion/types.ts'
import { useSim } from '../../motion/useMotionLoop.ts'
import { findExercise, libraryFor, useExerciseExtras } from '../../product/catalog.ts'
import { frameFor } from '../../rig/cameras.ts'
import { Humanoid } from '../../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../../rig/Scene.tsx'
import { useRehab } from '../../store/rehabStore.ts'
import { InfoTip } from '../../ui/InfoTip.tsx'
import { Choice, RomBar } from '../../ui/widgets.tsx'

export function ExerciseDetailPage() {
  const { exerciseId = '' } = useParams()
  const extras = useExerciseExtras()
  const side = useRehab((state) => state.side)
  const exercise = findExercise(exerciseId, extras)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState('1')
  const [angle, setAngle] = useState(0)
  const info = exercise ? libraryFor(exercise) : null
  const sim = useSim((time) => {
    if (!exercise) return { arm: poseFromAngles(REST_ANGLES, side) }
    const angles = sampleExercise(exercise, time)
    return { arm: poseFromAngles(angles, side), angles }
  }, poseFromAngles(REST_ANGLES, side))
  sim.playingRef.current = playing
  sim.speedRef.current = Number(speed)
  sim.onHudRef.current = (frame) => {
    if (!exercise || !('angles' in frame) || !frame.angles) return
    setAngle(frame.angles[focusKey(exercise)])
  }

  if (!exercise || !info) {
    return (
      <div className="page">
        <h1>Exercise not found</h1>
        <Link to="/exercises" className="ghost-btn">Back to exercises</Link>
      </div>
    )
  }

  const shot = frameFor(exercise.focus, side)
  const target = peakFocus(exercise)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="heading-row">
            <p className="kicker">How to perform it</p>
            <InfoTip label="About this demo">
              <p>{info.purpose}</p>
              {info.cues ? <p>{info.cues}</p> : null}
              <p>Tracked sensors: {info.tracked.join(', ')}. The highlighted region is the main moving area, not a muscle EMG reading.</p>
            </InfoTip>
          </div>
          <h1>{exercise.name}</h1>
          {info.conditions.length ? (
            <div className="condition-pills" style={{ marginTop: 8 }}>
              {info.conditions.map((condition) => (
                <span key={condition} className="pill">{condition}</span>
              ))}
            </div>
          ) : null}
        </div>
        <Link to={`/session/setup?exercise=${exercise.id}`} className="candy">Start exercise</Link>
      </header>
      <div className="session-layout">
        <div className="stage">
          <Scene camera={shot.cam} look={shot.look}>
            <Humanoid side={side} poseRef={sim.poseRef} slerp={0.25} rom={{ target }} highlight={muscleHighlight(exercise)} legDrive={legDriveFor(exercise)} />
            <GlideCamera cam={shot.cam} look={shot.look} token={exercise.id} />
          </Scene>
          <div className="float-chip">Preview</div>
        </div>
        <aside className="panel">
          <p>{info.cues || info.purpose}</p>
          <div className="stat-row"><span>Target</span><strong>{Math.round(Math.abs(target))}°</strong></div>
          <div className="stat-row"><span>Repetitions</span><strong>{info.reps}</strong></div>
          <div className="stat-row"><span>Hold</span><strong>{info.hold} sec</strong></div>
          <RomBar min={exercise.limit.min} max={exercise.limit.max} value={angle} target={target} />
          <div className="row">
            <button type="button" className="candy" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'}</button>
          </div>
          <Choice
            value={speed}
            onChange={setSpeed}
            options={[
              { id: '0.5', label: '0.5×' },
              { id: '1', label: '1×' },
            ]}
          />
          <Link to={`/session/setup?exercise=${exercise.id}`} className="ghost-btn">I’m ready</Link>
        </aside>
      </div>
    </div>
  )
}
