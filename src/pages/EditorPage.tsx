import { useRef, useState } from 'react'
import { EXERCISES, regionFor, sampleExercise } from '../motion/exercises.ts'
import { poseFromAngles } from '../motion/quat.ts'
import {
  REST_ANGLES,
  type Exercise,
  type ExerciseFocus,
  type JointAngles,
} from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { Choice, Slider, TestPage } from '../ui/widgets.tsx'

type Frame = { time: number; angles: JointAngles }

const starter: Frame[] = EXERCISES[0].keyframes.map((frame) => ({
  time: frame.time,
  angles: { ...frame.angles },
}))

export function EditorPage() {
  const side = useRehab((state) => state.side)
  const setCustomExercise = useRehab((state) => state.setCustomExercise)
  const [name, setName] = useState('Elbow Flexion')
  const [focus, setFocus] = useState<ExerciseFocus>('elbow')
  const [frames, setFrames] = useState<Frame[]>(starter)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [saved, setSaved] = useState(false)
  const framesRef = useRef(frames)
  const indexRef = useRef(index)
  const focusRef = useRef(focus)
  const nameRef = useRef(name)
  framesRef.current = frames
  indexRef.current = index
  focusRef.current = focus
  nameRef.current = name
  const selected = frames[index] ?? frames[0]
  const duration = Math.max(0.5, frames[frames.length - 1]?.time ?? 1)
  const shot = frameFor(focus, side)

  const sim = useSim((time) => {
    const angles = playing
      ? sampleExercise(makeExercise(nameRef.current, focusRef.current, framesRef.current), time)
      : (framesRef.current[indexRef.current]?.angles ?? REST_ANGLES)
    return { arm: poseFromAngles(angles, side), angles }
  }, poseFromAngles(starter[0].angles, side), false)
  sim.playingRef.current = playing

  function updateAngle(key: keyof JointAngles, value: number) {
    setPlaying(false)
    setFrames((prev) =>
      prev.map((frame, frameIndex) =>
        frameIndex === index ? { ...frame, angles: { ...frame.angles, [key]: value } } : frame,
      ),
    )
  }

  const json = {
    name,
    duration,
    keyframes: frames.map((frame) => ({
      time: Number(frame.time.toFixed(2)),
      elbow: Math.round(frame.angles.elbowFlexion),
      shoulderFlexion: Math.round(frame.angles.shoulderFlexion),
      shoulderAbduction: Math.round(frame.angles.shoulderAbduction),
      wrist: Math.round(frame.angles.wristFlexion),
    })),
  }

  return (
    <TestPage
      kicker="Author"
      title="Exercise editor"
      lede="Pose the avatar, store that pose as a keyframe, then play the blend. Saving puts the exercise on the playback page."
      note={playing ? 'Playing blend' : `Pose ${index + 1}`}
      panel={
        <div className="stack">
          <label className="field">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <Choice
            value={focus}
            options={[
              { id: 'elbow', label: 'Elbow' },
              { id: 'shoulder', label: 'Shoulder' },
              { id: 'wrist', label: 'Wrist' },
              { id: 'hip', label: 'Hip' },
              { id: 'knee', label: 'Knee' },
              { id: 'ankle', label: 'Ankle' },
            ]}
            onChange={(value) => {
              setFocus(value)
              setPlaying(false)
            }}
          />
          <div className="frame-list">
            {frames.map((frame, frameIndex) => (
              <button
                key={`${frame.time}-${frameIndex}`}
                type="button"
                className={frameIndex === index ? 'on' : ''}
                onClick={() => {
                  setPlaying(false)
                  setIndex(frameIndex)
                }}
              >
                {frame.time.toFixed(1)}s · elbow {frame.angles.elbowFlexion.toFixed(0)}°
              </button>
            ))}
          </div>
          <Slider label="Shoulder flexion" min={-20} max={160} value={selected.angles.shoulderFlexion} onChange={(value) => updateAngle('shoulderFlexion', value)} />
          <Slider label="Shoulder abduction" min={0} max={150} value={selected.angles.shoulderAbduction} onChange={(value) => updateAngle('shoulderAbduction', value)} />
          <Slider label="Elbow flexion" min={0} max={150} value={selected.angles.elbowFlexion} onChange={(value) => updateAngle('elbowFlexion', value)} />
          <Slider label="Wrist flexion" min={-60} max={70} value={selected.angles.wristFlexion} onChange={(value) => updateAngle('wristFlexion', value)} />
          <Slider label="Hip flexion" min={-10} max={120} value={selected.angles.hipFlexion} onChange={(value) => updateAngle('hipFlexion', value)} />
          <Slider label="Hip abduction" min={0} max={50} value={selected.angles.hipAbduction} onChange={(value) => updateAngle('hipAbduction', value)} />
          <Slider label="Knee flexion" min={0} max={140} value={selected.angles.kneeFlexion} onChange={(value) => updateAngle('kneeFlexion', value)} />
          <Slider label="Ankle" min={-40} max={40} value={selected.angles.ankleFlexion} onChange={(value) => updateAngle('ankleFlexion', value)} />
          <Slider
            label="Time"
            min={0}
            max={12}
            step={0.1}
            value={selected.time}
            onChange={(value) => {
              setPlaying(false)
              setFrames((prev) => prev.map((frame, frameIndex) => (frameIndex === index ? { ...frame, time: value } : frame)))
            }}
            unit="s"
          />
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPlaying(false)
                setFrames((prev) => {
                  const last = prev[prev.length - 1]
                  const angles = { ...(prev[index]?.angles ?? REST_ANGLES) }
                  return [...prev, { time: Number((last.time + 1).toFixed(1)), angles }]
                })
                setIndex(frames.length)
              }}
            >
              Add pose
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (frames.length < 3) return
                setPlaying(false)
                setFrames((prev) => prev.filter((_, frameIndex) => frameIndex !== index))
                setIndex(0)
              }}
            >
              Delete
            </button>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (playing) {
                  setPlaying(false)
                  return
                }
                sim.timeRef.current = 0
                setPlaying(true)
              }}
            >
              {playing ? 'Stop' : 'Play blend'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCustomExercise(makeExercise(name, focus, frames))
                setSaved(true)
              }}
            >
              Save exercise
            </button>
          </div>
          {saved ? <p>Saved. Open Exercise playback and choose this name.</p> : null}
          <pre className="json">{JSON.stringify(json, null, 2)}</pre>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look}>
        <Humanoid key={side} side={side} poseRef={sim.poseRef} slerp={playing ? 0.25 : 1} />
        <GlideCamera cam={shot.cam} look={shot.look} token={`${focus}-${side}`} />
      </Scene>
    </TestPage>
  )
}

function makeExercise(name: string, focus: ExerciseFocus, frames: Frame[]): Exercise {
  const ordered = [...frames].sort((a, b) => a.time - b.time)
  const duration = Math.max(0.5, ordered[ordered.length - 1]?.time ?? 1)
  const region = regionFor(focus)
  return {
    id: 'custom',
    name: name.trim() || 'Custom exercise',
    duration,
    focus,
    region,
    limit: { min: 0, max: 130 },
    keyframes: ordered.map((frame) => ({ time: frame.time, angles: { ...frame.angles } })),
  }
}
