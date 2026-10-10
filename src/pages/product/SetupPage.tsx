import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { findExercise, libraryFor, useExerciseExtras } from '../../product/catalog.ts'
import { peakFocus } from '../../motion/exercises.ts'
import { useMotionStore } from '../../sensors/motionStore.ts'
import { sendMotionCommand } from '../../sensors/useMotionStream.ts'
import { useRehab } from '../../store/rehabStore.ts'
import { DevicePanel } from '../../ui/DevicePanel.tsx'
import { InfoTip } from '../../ui/InfoTip.tsx'

export function SetupPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const extras = useExerciseExtras()
  const setActiveExerciseId = useRehab((state) => state.setActiveExerciseId)
  const connected = useMotionStore((state) => state.connected)
  const upperSensor = useMotionStore((state) => state.upperArmSensor)
  const forearmSensor = useMotionStore((state) => state.forearmSensor)
  const calibrationStatus = useMotionStore((state) => state.calibrationStatus)
  const calibrationError = useMotionStore((state) => state.lastError)
  const requested = params.get('exercise') ?? 'elbow-flexion'
  const exercise = findExercise(requested, extras) ?? findExercise('elbow-flexion', extras)
  const [step, setStep] = useState(1)
  const [count, setCount] = useState(3)
  const [running, setRunning] = useState(false)
  const [awaitingCalibration, setAwaitingCalibration] = useState(false)
  const info = exercise ? libraryFor(exercise) : null
  const ready = connected && upperSensor && forearmSensor

  useEffect(() => {
    if (!running) return
    if (count <= 0) {
      setRunning(false)
      if (sendMotionCommand('calibrate')) setAwaitingCalibration(true)
      return
    }
    const id = window.setTimeout(() => setCount((value) => value - 1), 800)
    return () => window.clearTimeout(id)
  }, [count, running])

  useEffect(() => {
    if (awaitingCalibration && calibrationStatus === 'complete') {
      setAwaitingCalibration(false)
      setStep(3)
    }
  }, [awaitingCalibration, calibrationStatus])

  if (!exercise || !info) return null

  return (
    <div className="page">
      <header>
        <p className="kicker">Step {step} of 3</p>
        <h1>{step === 1 ? 'Connect sensors' : step === 2 ? 'Calibration' : exercise.name}</h1>
      </header>
      <div className="steps" aria-hidden="true">
        {[1, 2, 3].map((item) => (
          <span key={item} className={item === step ? 'on' : item < step ? 'done' : ''}>{item}</span>
        ))}
      </div>

      {step === 1 ? (
        <section className="sticker" style={{ maxWidth: 560 }}>
          <div className="heading-row">
            <p className="kicker">Sensors</p>
            <InfoTip label="Why this step">
              <p>Strap the upper-arm and forearm sensors, then we set a zero pose. If a sensor drops out later, tracking pauses instead of guessing. The hand sensor is optional.</p>
            </InfoTip>
          </div>
          <DevicePanel />
          <div className="row">
            <button type="button" className="candy" disabled={!ready} onClick={() => setStep(2)}>
              Continue
            </button>
            <Link to="/" className="ghost-btn">Not now</Link>
          </div>
          {!ready ? <p>Upper arm and forearm need to be connected before you start.</p> : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="sticker" style={{ maxWidth: 640 }}>
          <p>Let your arm rest naturally at your side. Stay still.</p>
          <p className="count">{running ? Math.max(count, 1) : 'Ready'}</p>
          <button
            type="button"
            className="candy"
            disabled={running || awaitingCalibration || !ready}
            onClick={() => {
              setCount(3)
              setRunning(true)
            }}
          >
            {running
              ? 'Hold still'
              : awaitingCalibration
                ? 'Calibrating…'
                : 'Start calibration'}
          </button>
          {calibrationStatus === 'failed' || calibrationError ? (
            <p className="attention">
              {calibrationError ?? 'Calibration failed. Keep both sensors still and try again.'}
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="sticker" style={{ maxWidth: 680 }}>
          <p className="kicker">Calibration complete</p>
          <h2>{exercise.name}</h2>
          <div className="stat-row"><span>Repetitions</span><strong>{info.reps}</strong></div>
          <div className="stat-row"><span>Target</span><strong>{Math.round(peakFocus(exercise))}°</strong></div>
          <div className="stat-row"><span>Hold</span><strong>{info.hold} sec</strong></div>
          <div className="row">
            <button
              type="button"
              className="candy"
              onClick={() => {
                setActiveExerciseId(exercise.id)
                navigate(`/session/live?exercise=${exercise.id}`)
              }}
            >
              Begin
            </button>
            <button type="button" className="ghost-btn" onClick={() => setStep(2)}>Recalibrate</button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
