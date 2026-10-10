import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { focusKey, legDriveFor, muscleHighlight, peakFocus, sampleExercise } from '../../motion/exercises.ts'
import { errorColor, matchPercent, poseFromAngles, segmentErrors } from '../../motion/quat.ts'
import { createRepCounter, scoreWindow } from '../../motion/scoring.ts'
import { createArm, isLegFocus, REST_ANGLES, writeArm, type JointAngles, type JointId } from '../../motion/types.ts'
import { useSim } from '../../motion/useMotionLoop.ts'
import { libraryFor, findExercise, useExerciseExtras } from '../../product/catalog.ts'
import { frameFor } from '../../rig/cameras.ts'
import { Humanoid, type SegmentColors } from '../../rig/Humanoid.tsx'
import { Scene } from '../../rig/Scene.tsx'
import { beginSessionLink, getSessionLink, useMotionStore } from '../../sensors/motionStore.ts'
import { sendMotionCommand } from '../../sensors/useMotionStream.ts'
import { useRehab } from '../../store/rehabStore.ts'
import { buildAssessment } from '../../trial/endpoints.ts'
import { isoDate } from '../../trial/math.ts'
import type { AngleSample } from '../../trial/types.ts'
import { PatientAvatar } from '../../three/PatientAvatar.tsx'
import { batteryCaption } from '../../ui/DevicePanel.tsx'
import { InfoTip } from '../../ui/InfoTip.tsx'
import { Choice, RomBar } from '../../ui/widgets.tsx'

type ViewMode = 'overlay' | 'beside' | 'patient' | 'target'
type DisplayMode = 'normal' | 'trail' | 'path'

export function LiveSessionPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const extras = useExerciseExtras()
  const side = useRehab((state) => state.side)
  const mode = useRehab((state) => state.viewerMode)
  const showSkeleton = useRehab((state) => state.showSkeleton)
  const showAxes = useRehab((state) => state.showAxes)
  const setFlag = useRehab((state) => state.setFlag)
  const addAssessment = useRehab((state) => state.addAssessment)
  const activePatientId = useRehab((state) => state.activePatientId)
  const patients = useRehab((state) => state.patients)
  const motionStatus = useMotionStore((state) => state.status)
  const socketConnected = useMotionStore((state) => state.connected)
  const upperArmSensor = useMotionStore((state) => state.upperArmSensor)
  const forearmSensor = useMotionStore((state) => state.forearmSensor)
  const handSensor = useMotionStore((state) => state.handSensor)
  const elbowAngle = useMotionStore((state) => state.elbowAngle)
  const shoulderAngle = useMotionStore((state) => state.shoulderAngle)
  const wristAngle = useMotionStore((state) => state.wristAngle)
  const packetLoss = useMotionStore((state) => state.packetLoss)
  const battery = useMotionStore((state) => state.battery)
  const charging = useMotionStore((state) => state.charging)
  const chargeState = useMotionStore((state) => state.chargeState)
  const exercise = findExercise(params.get('exercise') ?? 'elbow-flexion', extras) ?? findExercise('elbow-flexion', extras)
  const info = exercise ? libraryFor(exercise) : null
  const [view, setView] = useState<ViewMode>('overlay')
  const [display, setDisplay] = useState<DisplayMode>('normal')
  const [focus, setFocus] = useState(false)
  const [paused, setPaused] = useState(false)
  const [selected, setSelected] = useState<JointId | null>(null)
  const [trailReset, setTrailReset] = useState(0)
  const [zeroed, setZeroed] = useState(false)
  const startAngles = exercise?.keyframes[0]?.angles ?? REST_ANGLES
  const livePoseRef = useRef(createArm(poseFromAngles(startAngles, side)))
  const targetAnglesRef = useRef<JointAngles>(startAngles)
  const legExercise = exercise ? isLegFocus(exercise.focus) : false
  const disconnected =
    !legExercise && (
      !socketConnected ||
      motionStatus === 'reconnecting' ||
      motionStatus === 'sensor_lost' ||
      !upperArmSensor ||
      !forearmSensor
    )
  const [hud, setHud] = useState({
    angle: startAngles[exercise ? focusKey(exercise) : 'elbowFlexion'] ?? 5,
    target: exercise ? peakFocus(exercise) : 90,
    reps: 0,
    score: 90,
    smoothness: 90,
    range: 90,
    peak: 5,
    compensation: 96,
    velocity: 0,
    cheat: 0,
    wrist: 0,
    colors: {} as SegmentColors,
    ideal: startAngles,
    patient: startAngles,
  })
  const latest = useRef(hud)
  latest.current = hud
  const history = useRef<{ patient: JointAngles; ideal: JointAngles }[]>([])
  const samples = useRef<AngleSample[]>([])
  const sessionStarted = useRef(performance.now())
  const reps = useRef(createRepCounter(() => bands(exercise)))
  const prev = useRef({ t: 0, value: 0, peakSpeed: 0 })

  useEffect(() => {
    beginSessionLink()
    samples.current = []
    sessionStarted.current = performance.now()
  }, [])

  const targetSim = useSim((time) => {
    const angles = exercise
      ? sampleExercise(exercise, time)
      : targetAnglesRef.current
    return { arm: poseFromAngles(angles, side), angles }
  }, poseFromAngles(targetAnglesRef.current, side), true)
  targetSim.playingRef.current = !paused && (!disconnected || legExercise)
  targetSim.onFrameRef.current = (frame) => {
    targetAnglesRef.current = frame.angles
  }
  targetSim.onHudRef.current = (frame) => {
    if (!exercise || !legExercise) return
    const key = focusKey(exercise)
    const value = frame.angles[key] ?? 0
    samples.current.push({
      t: (performance.now() - sessionStarted.current) / 1000,
      angle: value,
      velocity: 0,
      compensation: 0,
    })
    setHud((current) => ({
      ...current,
      angle: value,
      target: peakFocus(exercise),
      ideal: frame.angles,
      patient: frame.angles,
    }))
  }

  useEffect(() => {
    if (!exercise || elbowAngle === null || disconnected || paused || legExercise) return
    const ideal = targetAnglesRef.current
    const patient: JointAngles = {
      ...ideal,
      shoulderFlexion: shoulderAngle ?? 0,
      shoulderAbduction: ideal.shoulderAbduction,
      elbowFlexion: elbowAngle,
      wristFlexion: wristAngle ?? 0,
    }
    const key = focusKey(exercise)
    const value = patient[key]
    reps.current.push(value)
    history.current.push({ patient, ideal })
    if (history.current.length > 400) history.current.shift()

    const now = performance.now() / 1_000
    const dt = now - prev.current.t
    const velocity = prev.current.t > 0 && dt > 0.02
      ? (value - prev.current.value) / dt
      : 0
    prev.current = {
      t: now,
      value,
      peakSpeed: Math.max(prev.current.peakSpeed, Math.abs(velocity)),
    }
    samples.current.push({
      t: (performance.now() - sessionStarted.current) / 1000,
      angle: value,
      velocity,
      compensation: Math.abs(patient.shoulderFlexion - ideal.shoulderFlexion),
    })
    const score = scoreWindow(history.current, exercise, reps.current.peak())
    const targetArm = poseFromAngles(ideal, side)
    const errors = segmentErrors(livePoseRef.current, targetArm)
    const cheat = Math.abs(patient.shoulderFlexion - ideal.shoulderFlexion)
    setHud({
      angle: value,
      target: peakFocus(exercise),
      reps: reps.current.reps(),
      score: score.total,
      smoothness: score.smoothness,
      range: score.range,
      peak: Math.round(reps.current.peak()),
      compensation: score.compensation,
      velocity,
      cheat,
      wrist: Math.abs(patient.wristFlexion - ideal.wristFlexion),
      ideal,
      patient,
      colors: {
        upper: cheat > 10 ? '#e39a3a' : errorColor(errors.upper),
        fore: errorColor(errors.fore),
        hand: errorColor(errors.hand),
      },
    })
  }, [
    disconnected,
    elbowAngle,
    exercise,
    legExercise,
    paused,
    shoulderAngle,
    side,
    wristAngle,
  ])

  if (!exercise || !info) return null
  const goal = info.reps
  const remaining = Math.max(0, hud.target - hud.angle)
  const shot = frameFor(exercise.focus, side)
  const beside = view === 'beside'
  const showPatient = view !== 'target'
  const showTarget = view !== 'patient'
  const drive = legDriveFor(exercise)

  function zeroPose() {
    const start = exercise?.keyframes[0]?.angles ?? REST_ANGLES
    const pose = poseFromAngles(start, side)
    targetSim.timeRef.current = 0
    writeArm(targetSim.poseRef.current, pose)
    writeArm(livePoseRef.current, pose)
    targetAnglesRef.current = start
    sendMotionCommand('calibrate')
    setTrailReset((value) => value + 1)
    setPaused(true)
    setZeroed(true)
  }

  function finish() {
    const snap = latest.current
    const patient = patients.find((item) => item.id === activePatientId)
    const link = getSessionLink()
    addAssessment(
      buildAssessment({
        participantId: activePatientId,
        participantCode: patient?.code ?? activePatientId,
        assessmentId: `${exercise?.id ?? 'elbow-flexion'}-v1`,
        exerciseId: exercise?.id ?? 'elbow-flexion',
        exerciseName: exercise?.name ?? 'Session',
        sessionDate: isoDate(),
        week: 0,
        repGoal: goal,
        holdSec: info.hold,
        repsCompleted: Math.max(snap.reps, samples.current.length ? 1 : 0),
        formScore: snap.score,
        targetRom: Math.round(snap.target),
        durationSec: (performance.now() - sessionStarted.current) / 1000,
        link: {
          ...link,
          dropoutRep: link.dropoutRep,
        },
        samples: samples.current,
      }),
    )
    navigate('/session/results')
  }

  const actions = (
    <div className="session-actions">
      <button type="button" className="ghost-btn" onClick={() => {
        setPaused((value) => !value)
        setZeroed(false)
      }}>{paused ? 'Resume' : 'Pause'}</button>
      <button type="button" className="ghost-btn" onClick={zeroPose}>Zero</button>
      <button type="button" className="ghost-btn" onClick={() => setFocus((value) => !value)}>{focus ? 'Show details' : 'Focus mode'}</button>
      <button type="button" className="candy" onClick={finish}>End session</button>
    </div>
  )

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <header className="page-head">
        <div>
          <p className="kicker"><Link to="/">Session</Link></p>
          <h1>{exercise.name}</h1>
        </div>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>{Math.min(hud.reps, goal)} / {goal}</strong>
      </header>

      <div className={focus ? 'session-layout focus' : 'session-layout'}>
        <div className="stage" style={beside ? { height: 'min(72vh, 760px)' } : undefined}>
          <Scene camera={beside ? [0.2, 1.15, 3.4] : shot.cam} look={beside ? [0, 1.05, 0] : shot.look}>
            {showTarget ? (
              <Humanoid
                side={side}
                poseRef={targetSim.poseRef}
                ghost={view !== 'target'}
                position={beside ? [-0.7, 0, 0] : [0, 0, 0]}
                slerp={0.2}
                label={beside ? 'Target' : undefined}
                legDrive={drive}
                highlight={muscleHighlight(exercise)}
              />
            ) : null}
            {showPatient ? (
              <PatientAvatar
                side={side}
                livePoseRef={livePoseRef}
                tracking={!paused && !disconnected}
                position={beside ? [0.7, 0, 0] : [0, 0, 0]}
                slerp={0.2}
                colors={hud.colors}
                rom={display === 'path' && !legExercise ? { target: hud.target } : null}
                trail={display === 'trail'}
                trailJoint={legExercise ? 'foot' : 'hand'}
                trailReset={trailReset}
                showSkeleton={mode === 'clinician' && showSkeleton}
                showAxes={mode === 'clinician' && showAxes}
                showSensors={mode === 'clinician'}
                selected={selected}
                onSelect={setSelected}
                label={beside ? 'You' : undefined}
                legDrive={drive}
              />
            ) : null}
          </Scene>
          <div className="float-chip">{zeroed && paused ? 'Zeroed' : focus ? 'Keep going' : `${Math.round(hud.angle)}° / ${Math.round(hud.target)}°`}</div>
          {disconnected ? (
            <div className="pause-banner">
              <div className="sticker">
                <p className="kicker">Movement tracking paused</p>
                <h2>
                  {!socketConnected
                    ? 'Reconnecting to sensors…'
                    : !forearmSensor
                      ? 'Forearm sensor disconnected'
                      : 'Upper arm sensor disconnected'}
                </h2>
                <p>Check that the sensor is powered and within range. The avatar will not guess while the signal is missing.</p>
                <Link to="/settings/devices" className="candy">Reconnect</Link>
              </div>
            </div>
          ) : null}
        </div>

        {focus ? null : (
          <aside className="panel">
            <p className="kicker">Target {Math.round(hud.target)}°</p>
            <h2>Current {Math.round(hud.angle)}°</h2>
            <RomBar min={exercise.limit.min} max={exercise.limit.max} value={hud.angle} target={hud.target} />
            <p>{remaining.toFixed(0)}° remaining this moment</p>
            <div className="heading-row">
              <h2>Form</h2>
              <InfoTip label="Form cues">
                <p>These flags come from the live pose versus the target. They are coaching hints, not a clinical exam.</p>
              </InfoTip>
            </div>
            {legExercise ? (
              <>
                <p className="check-line"><span>Match the ghost through the full range</span></p>
                <p className="check-line"><span>Move with a steady tempo</span></p>
                <p className="check-line"><span>Zero first if the start pose does not match</span></p>
              </>
            ) : (
              <>
                <p className="check-line"><span>{hud.cheat < 10 ? 'Upper arm stable' : 'Upper arm is helping too much'}</span></p>
                <p className="check-line"><span>{hud.wrist < 8 ? 'Wrist is quiet' : 'Wrist is rotating a little'}</span></p>
                <p className="check-line"><span>{Math.abs(hud.velocity) < 120 ? 'Good movement speed' : 'Try a slower tempo'}</span></p>
              </>
            )}
            <div className="stat-row"><span>Score</span><strong>{hud.score}</strong></div>
            <details className="more-info">
              <summary>Session details</summary>
              <div className="stat-row"><span>Smoothness</span><strong>{hud.smoothness}</strong></div>
              <div className="stat-row"><span>Best so far</span><strong>{hud.peak}°</strong></div>
              <div className="stat-row"><span>Compensation</span><strong>{hud.compensation}</strong></div>
              <div className="stat-row"><span>Board power</span><strong>{batteryCaption(battery, charging, chargeState)}</strong></div>
            </details>
            <div className="control-block">
              <p className="control-label">View</p>
              <Choice
                value={view}
                onChange={setView}
                columns={2}
                options={[
                  { id: 'overlay', label: 'Overlay' },
                  { id: 'beside', label: 'Side by side' },
                  { id: 'patient', label: 'You only' },
                  { id: 'target', label: 'Target only' },
                ]}
              />
            </div>
            <div className="control-block">
              <p className="control-label">Display</p>
              <Choice
                value={display}
                onChange={setDisplay}
                columns={3}
                options={[
                  { id: 'normal', label: 'Normal' },
                  { id: 'trail', label: 'Trail' },
                  { id: 'path', label: 'Path' },
                ]}
              />
            </div>
            {selected ? (
              <div className="sticker" style={{ boxShadow: '4px 4px 0 var(--amber)', padding: 12 }}>
                <p className="kicker">{selected}</p>
                <div className="stat-row"><span>Current angle</span><strong>{Math.round(selected === 'elbow' ? hud.angle : selected === 'wrist' ? hud.wrist : hud.cheat)}°</strong></div>
                <div className="stat-row"><span>Speed</span><strong>{Math.abs(hud.velocity).toFixed(0)}°/s</strong></div>
                <div className="stat-row"><span>Sensor</span><strong>{sensorFor(selected, { upper: upperArmSensor, fore: forearmSensor, hand: handSensor }) ? 'Connected' : 'Not connected'}</strong></div>
                {mode === 'clinician' ? (
                  <>
                    <div className="stat-row"><span>Deviation</span><strong>{Math.round(selected === 'shoulder' ? hud.cheat : remaining)}°</strong></div>
                    <div className="stat-row"><span>Peak speed</span><strong>{prev.current.peakSpeed.toFixed(0)}°/s</strong></div>
                    <div className="stat-row"><span>Packet loss</span><strong>{packetLoss.toFixed(1)}%</strong></div>
                    <div className="stat-row"><span>Match</span><strong>{matchPercent(livePoseRef.current, targetSim.poseRef.current)}%</strong></div>
                  </>
                ) : null}
              </div>
            ) : null}
            {mode === 'clinician' ? (
              <details className="more-info">
                <summary>Clinician overlays</summary>
                <label className="toggle"><input type="checkbox" checked={showSkeleton} onChange={(event) => setFlag('showSkeleton', event.target.checked)} /> Skeleton</label>
                <label className="toggle"><input type="checkbox" checked={showAxes} onChange={(event) => setFlag('showAxes', event.target.checked)} /> Joint axes</label>
              </details>
            ) : null}
            <div className="control-block">
              <div className="heading-row">
                <p className="control-label">Session</p>
                <InfoTip label="Zero">
                  <p>Hold the extended start pose, then tap Zero. That sets the current sensor reading as rest and rewinds the demo to the straight starting frame so you and the ghost begin together.</p>
                </InfoTip>
              </div>
              {actions}
              {zeroed ? <p className="zero-note">Zeroed at the extended start. Resume when you are ready.</p> : null}
            </div>
          </aside>
        )}
      </div>
      {focus ? (
        <div className="stack" style={{ marginTop: 12 }}>
          <strong>Score {hud.score}</strong>
          {actions}
        </div>
      ) : null}
    </div>
  )
}

function bands(exercise: ReturnType<typeof findExercise>) {
  if (!exercise) return { high: 70, low: 30 }
  const key = focusKey(exercise)
  const start = exercise.keyframes[0]?.angles[key] ?? 0
  const peak = peakFocus(exercise)
  return { high: start + (peak - start) * 0.72, low: start + (peak - start) * 0.28 }
}

function sensorFor(joint: JointId, sensors: { upper: boolean; fore: boolean; hand: boolean }) {
  if (joint === 'shoulder' || joint === 'hip') return sensors.upper
  if (joint === 'elbow' || joint === 'knee') return sensors.fore
  return sensors.hand
}
