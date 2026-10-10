import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EXERCISES, sampleExercise, scaleFocus } from '../../motion/exercises.ts'
import { poseFromAngles } from '../../motion/quat.ts'
import { createArm, writeArm } from '../../motion/types.ts'
import { useSim } from '../../motion/useMotionLoop.ts'
import { CAM } from '../../rig/cameras.ts'
import { Humanoid } from '../../rig/Humanoid.tsx'
import { Scene } from '../../rig/Scene.tsx'
import { useRehab } from '../../store/rehabStore.ts'
import { useRef } from 'react'
import { shortDate } from '../../trial/math.ts'
import { MotionQcPanel } from '../../trial/MotionQcPanel.tsx'
import { Choice } from '../../ui/widgets.tsx'

export function ReviewPage() {
  const { sessionId = '' } = useParams()
  const history = useRehab((state) => state.history)
  const assessments = useRehab((state) => state.assessments)
  const side = useRehab((state) => state.side)
  const record = assessments.find((item) => item.id === sessionId)
  const session = history.find((item) => item.id === sessionId) ?? (record ? {
    id: record.id,
    date: record.sessionDate,
    name: record.exerciseName,
    exerciseId: record.exerciseId,
    reps: record.endpoints.validReps,
    repGoal: record.qc.repsRequired,
    score: record.formScore,
    rom: Math.round(record.endpoints.maxRom),
    target: Math.round(record.targetRom),
    smoothness: Math.round(record.endpoints.smoothness * 100),
    compensation: record.qc.qualityScore,
    shoulderExtra: Math.round(record.endpoints.compensationAngle),
  } : history[0])
  const [speed, setSpeed] = useState('1')
  const [playing, setPlaying] = useState(true)
  const [compare, setCompare] = useState<'target' | 'previous' | 'baseline'>('previous')
  const [clock, setClock] = useState(0)
  const otherRef = useRef(createArm())
  const exercise = EXERCISES.find((item) => item.id === session?.exerciseId) ?? EXERCISES[0]

  const sim = useSim((time) => {
    const ideal = sampleExercise(exercise, time)
    const current = scaleFocus(ideal, exercise, session ? session.rom / Math.max(session.target, 1) : 0.9, session && session.shoulderExtra > 10 ? 8 : 2)
    const other = compare === 'target'
      ? ideal
      : compare === 'baseline'
        ? scaleFocus(ideal, exercise, 0.62, 12)
        : scaleFocus(ideal, exercise, 0.75, 10)
    return { arm: poseFromAngles(current, side), other, current, ideal }
  }, createArm())
  sim.playingRef.current = playing
  sim.speedRef.current = Number(speed)
  sim.onFrameRef.current = (frame) => {
    writeArm(otherRef.current, poseFromAngles(frame.other, side))
  }
  sim.onHudRef.current = (_frame, time) => setClock(time % exercise.duration)

  if (!session) {
    return <div className="page"><h1>Session not found</h1><Link to="/progress">Back</Link></div>
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Session review</p>
          <h1>{record ? `${shortDate(record.sessionDate)} · ${record.exerciseName}` : `${session.date} · ${session.name}`}</h1>
        </div>
        <Link to="/progress" className="ghost-btn">All sessions</Link>
      </header>
      <div className="session-layout">
        <div className="stage">
          <Scene camera={CAM.wide.cam} look={CAM.wide.look}>
            <Humanoid side={side} poseRef={otherRef} ghost position={[-0.62, 0, 0]} label={compare === 'target' ? 'Target' : compare === 'baseline' ? 'Baseline' : 'Previous'} slerp={0.3} />
            <Humanoid side={side} poseRef={sim.poseRef} position={[0.62, 0, 0]} label="This session" slerp={0.3} />
          </Scene>
          <div className="float-chip">{clock.toFixed(1)}s / {exercise.duration}s</div>
        </div>
        <aside className="panel">
          <div className="row">
            <button type="button" className="candy" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'}</button>
          </div>
          <Choice
            value={speed}
            onChange={setSpeed}
            options={[{ id: '0.25', label: '0.25×' }, { id: '0.5', label: '0.5×' }, { id: '1', label: '1×' }]}
          />
          <label className="slider">
            <span className="slider-top"><span>Timeline</span><span>{clock.toFixed(1)}s</span></span>
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
                setClock(sim.timeRef.current)
              }}
            />
          </label>
          <div className="stat-row"><span>Maximum ROM</span><strong>{record ? `${record.endpoints.maxRom.toFixed(1)}°` : `${session.rom}°`}</strong></div>
          <div className="stat-row"><span>Mean ROM</span><strong>{record ? `${record.endpoints.meanRom.toFixed(1)}°` : '—'}</strong></div>
          <div className="stat-row"><span>Peak velocity</span><strong>{record ? `${record.endpoints.peakVelocity.toFixed(1)}°/s` : '—'}</strong></div>
          <div className="stat-row"><span>Smoothness</span><strong>{record ? record.endpoints.smoothness.toFixed(2) : session.smoothness}</strong></div>
          <div className="stat-row"><span>Compensation</span><strong>{session.shoulderExtra}°</strong></div>
          {session.shoulderExtra > 10 ? <p className="attention">Extra shoulder movement was recorded during this elbow exercise.</p> : <p>Shoulder movement stayed in the expected band.</p>}
          <h2>Compare with</h2>
          <Choice
            value={compare}
            onChange={setCompare}
            options={[
              { id: 'target', label: 'Target exercise' },
              { id: 'previous', label: 'Previous session' },
              { id: 'baseline', label: 'Baseline' },
            ]}
          />
          {record ? <MotionQcPanel qc={record.qc} compact /> : null}
        </aside>
      </div>
    </div>
  )
}
