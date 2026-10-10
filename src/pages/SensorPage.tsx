import { useEffect, useRef, useState } from 'react'
import { EXERCISES, sampleExercise } from '../motion/exercises.ts'
import { anglesFromArm, poseFromAngles } from '../motion/quat.ts'
import {
  applyCalibration,
  captureCalibration,
  createAngleFilter,
  jointSeparations,
  sensorFromBody,
  streamMessage,
  type Calibration,
} from '../motion/sensors.ts'
import { REST_ANGLES, type ArmPose, type JointAngles } from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { Slider, TestPage, Toggle } from '../ui/widgets.tsx'

const elbow = EXERCISES[0]

type Hud = {
  time: number
  exercise: JointAngles
  estimated: JointAngles
  arm: ArmPose
  separations: { elbow: number; wrist: number; shoulder: number }
}

export function SensorPage() {
  const side = useRehab((state) => state.side)
  const [playing, setPlaying] = useState(true)
  const [noise, setNoise] = useState(6)
  const [slerp, setSlerp] = useState(0.2)
  const [alpha, setAlpha] = useState(1)
  const [mountOn, setMountOn] = useState(false)
  const [cal, setCal] = useState<Calibration | null>(null)
  const noiseRef = useRef(noise)
  const alphaRef = useRef(alpha)
  const mountRef = useRef(mountOn)
  const calRef = useRef<Calibration | null>(null)
  const sideRef = useRef(side)
  const filterRef = useRef(createAngleFilter(REST_ANGLES))
  const lastBody = useRef<ArmPose | null>(null)
  noiseRef.current = noise
  alphaRef.current = alpha
  mountRef.current = mountOn
  calRef.current = cal
  sideRef.current = side

  const initial = sampleExercise(elbow, 0)
  const [hud, setHud] = useState<Hud>({
    time: 0,
    exercise: initial,
    estimated: initial,
    arm: poseFromAngles(initial, side),
    separations: { elbow: initial.elbowFlexion, wrist: 0, shoulder: 0 },
  })

  const sim = useSim((time) => {
    const exercise = sampleExercise(elbow, time)
    const noisy: JointAngles = {
      ...exercise,
      elbowFlexion: exercise.elbowFlexion + noiseRef.current * Math.sin(time * 37.1),
      shoulderFlexion: exercise.shoulderFlexion + noiseRef.current * 0.35 * Math.sin(time * 19.4),
      shoulderAbduction: exercise.shoulderAbduction + noiseRef.current * 0.12 * Math.sin(time * 13.2),
      wristFlexion: exercise.wristFlexion + noiseRef.current * 0.45 * Math.sin(time * 28.2),
    }
    const bodyAngles = filterRef.current(noisy, alphaRef.current)
    const body = poseFromAngles(bodyAngles, sideRef.current)
    const sensor = sensorFromBody(body, mountRef.current)
    const arm = calRef.current ? applyCalibration(sensor, calRef.current) : sensor
    return { arm, exercise, body, time }
  }, poseFromAngles(initial, side))
  sim.playingRef.current = playing
  sim.onFrameRef.current = (frame) => {
    lastBody.current = frame.body
  }
  sim.onHudRef.current = (frame) => {
    const estimated = anglesFromArm(frame.arm, sideRef.current)
    setHud({
      time: frame.time,
      exercise: frame.exercise,
      estimated,
      arm: {
        upper: [...frame.arm.upper],
        fore: [...frame.arm.fore],
        hand: [...frame.arm.hand],
        thigh: [...frame.arm.thigh],
        shin: [...frame.arm.shin],
        foot: [...frame.arm.foot],
      },
      separations: jointSeparations(frame.arm),
    })
  }

  useEffect(() => {
    setCal(null)
  }, [mountOn, side])

  const shot = frameFor('elbow', side)
  const message = streamMessage(hud.arm, hud.estimated, hud.time)

  return (
    <TestPage
      kicker="Fake MPU"
      title="Sensor stream"
      lede="Three built-in quaternions stand in for the upper arm, forearm, and hand. Mount error twists them. Calibrate stores q0 and the current body pose, then later frames use q_model0 · q0⁻¹ · q."
      note={cal ? 'Calibrated' : mountOn ? 'Raw sensor orientation' : 'No mount error'}
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
                if (lastBody.current) setCal(captureCalibration(lastBody.current, mountOn))
              }}
            >
              Calibrate
            </button>
          </div>
          <Toggle label="Mount error" checked={mountOn} onChange={setMountOn} />
          <Slider label="Noise" min={0} max={18} value={noise} onChange={setNoise} unit="°" />
          <Slider label="Bone slerp" min={0.05} max={1} step={0.05} value={slerp} onChange={setSlerp} unit="" />
          <Slider label="Angle filter" min={0.05} max={1} step={0.05} value={alpha} onChange={setAlpha} unit="" />
          <p>Filter 1 passes the signal through. Slerp 0.2 is the per-frame blend on the bones.</p>
          <h2>Elbow</h2>
          <p>Exercise {hud.exercise.elbowFlexion.toFixed(1)}°</p>
          <p>From relative quaternions {hud.separations.elbow.toFixed(1)}°</p>
          <p>Estimated flexion {hud.estimated.elbowFlexion.toFixed(1)}°</p>
          <div className="formula">q_elbow = q_upper⁻¹ · q_forearm</div>
          <h2>Stream frame</h2>
          <pre className="json">{JSON.stringify(message, null, 2)}</pre>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look}>
        <Humanoid key={side} side={side} poseRef={sim.poseRef} slerp={slerp} showSensors showAxes={mountOn && !cal} />
        <GlideCamera cam={shot.cam} look={shot.look} token={side} />
      </Scene>
    </TestPage>
  )
}
