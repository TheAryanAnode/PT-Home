import { useRef, useState } from 'react'
import { EXERCISES, focusKey, peakFocus, sampleExercise, sampleFrames, scaleFocus } from '../motion/exercises.ts'
import { poseFromAngles } from '../motion/quat.ts'
import { createArm, writeArm, type JointAngles } from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { CAM } from '../rig/cameras.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { Choice, TestPage } from '../ui/widgets.tsx'

const exercise = EXERCISES[0]

function cyclePeak(scale: number, extra: number) {
  const key = focusKey(exercise)
  let peak = 0
  for (let i = 0; i <= 24; i += 1) {
    const angles = scaleFocus(sampleExercise(exercise, (exercise.duration * i) / 24), exercise, scale, extra)
    peak = Math.max(peak, angles[key])
  }
  return peak
}

export function ReplayPage() {
  const side = useRehab((state) => state.side)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState('1')
  const [time, setTime] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recordedCount, setRecordedCount] = useState(0)
  const recordingRef = useRef(false)
  const capture = useRef<JointAngles[]>([])
  const recorded = useRef<JointAngles[] | null>(null)
  const recordStart = useRef(0)
  const previousRef = useRef(createArm())
  const [now, setNow] = useState({ previous: 0, current: 0 })

  const sim = useSim((t) => {
    const ideal = sampleExercise(exercise, t)
    const previous = scaleFocus(ideal, exercise, 0.68, 16)
    const generated = scaleFocus(ideal, exercise, 0.97, 3)
    const current = recorded.current && !recordingRef.current
      ? sampleFrames(recorded.current, exercise.duration, t)
      : generated
    return { arm: poseFromAngles(current, side), previous, current }
  }, poseFromAngles(sampleExercise(exercise, 0), side))
  sim.playingRef.current = playing
  sim.speedRef.current = Number(speed)
  sim.onFrameRef.current = (frame) => {
    writeArm(previousRef.current, poseFromAngles(frame.previous, side))
    if (!recordingRef.current) return
    capture.current.push(frame.current)
    if (sim.timeRef.current - recordStart.current >= exercise.duration) {
      recorded.current = capture.current.slice()
      recordingRef.current = false
      setRecording(false)
      setRecordedCount(recorded.current.length)
    }
  }
  sim.onHudRef.current = (frame, t) => {
    const key = focusKey(exercise)
    setTime(t)
    setNow({ previous: frame.previous[key], current: frame.current[key] })
  }

  const previousPeak = cyclePeak(0.68, 16)
  const currentPeak = recorded.current
    ? Math.max(...recorded.current.map((frame) => frame[focusKey(exercise)]))
    : cyclePeak(0.97, 3)
  const clock = ((time % exercise.duration) + exercise.duration) % exercise.duration

  return (
    <TestPage
      kicker="Session"
      title="Replay"
      lede="Previous is a weaker built-in take. Current is a fuller one until you record, then the scrubber plays the stored frames instead of the generator."
      note={recording ? 'Recording' : recordedCount ? `${recordedCount} stored frames` : 'Generated current take'}
      panel={
        <div className="stack">
          <div className="row">
            <button type="button" className="btn primary" onClick={() => setPlaying((value) => !value)}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                capture.current = []
                recorded.current = null
                recordStart.current = sim.timeRef.current
                recordingRef.current = true
                setRecording(true)
                setRecordedCount(0)
                setPlaying(true)
              }}
            >
              Record one rep
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
              <span className="mono">{clock.toFixed(2)}s</span>
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
          <p>Previous ROM now {now.previous.toFixed(0)}°. Current {now.current.toFixed(0)}°.</p>
          <p>
            Peak previous {previousPeak.toFixed(0)}°. Peak current {currentPeak.toFixed(0)}°. Change{' '}
            {(currentPeak - previousPeak).toFixed(0)}°.
          </p>
          <p>Target peak for this exercise is {peakFocus(exercise).toFixed(0)}°.</p>
        </div>
      }
    >
      <Scene camera={CAM.wide.cam} look={CAM.wide.look}>
        <Humanoid side={side} poseRef={previousRef} position={[-0.62, 0, 0]} label="Previous" slerp={0.3} />
        <Humanoid side={side} poseRef={sim.poseRef} position={[0.62, 0, 0]} label="Current" slerp={0.3} />
      </Scene>
    </TestPage>
  )
}
