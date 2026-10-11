import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NAV } from '../../nav.ts'
import { getLatestMotionFrame, useMotionStore } from '../../sensors/motionStore.ts'
import type { IMUReading } from '../../sensors/types.ts'
import { reconnectMotionStream, sendMotionCommand } from '../../sensors/useMotionStream.ts'
import { useRehab } from '../../store/rehabStore.ts'
import { DevicePanel } from '../../ui/DevicePanel.tsx'
import { MpuDebugPanel } from '../../ui/MpuDebugPanel.tsx'

export function SettingsPage() {
  const mode = useRehab((state) => state.viewerMode)
  const setViewerMode = useRehab((state) => state.setViewerMode)
  const patients = useRehab((state) => state.patients)
  const activePatientId = useRehab((state) => state.activePatientId)
  const setActivePatientId = useRehab((state) => state.setActivePatientId)
  return (
    <div className="page">
      <header>
        <p className="kicker">Settings</p>
        <h1>How PT@Home is set up</h1>
      </header>
      <section className="sticker">
        <h2>Who is looking</h2>
        <p className="quiet">Patients see the session. Clinicians see participants, the builder, and the same progress story with more detail.</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className={mode === 'patient' ? 'candy' : 'ghost-btn'} onClick={() => setViewerMode('patient')}>Patient</button>
          <button type="button" className={mode === 'clinician' ? 'candy' : 'ghost-btn'} onClick={() => setViewerMode('clinician')}>Clinician</button>
        </div>
        {mode === 'patient' ? (
          <label className="field" style={{ marginTop: 14 }}>
            This device belongs to
            <select value={activePatientId} onChange={(event) => setActivePatientId(event.target.value)}>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>{patient.name} ({patient.code})</option>
              ))}
            </select>
          </label>
        ) : null}
      </section>
      <section className="pair">
        <Link to="/settings/devices" className="sticker exercise-card">
          <p className="kicker">Hardware</p>
          <h2>Device status</h2>
          <p>Connection, battery, sampling, and calibration.</p>
        </Link>
        <Link to="/dev" className="sticker exercise-card featured">
          <p className="kicker">Developer lab</p>
          <h2>Digital twin tests</h2>
          <p>The original subsystem pages, kept for building and debugging.</p>
        </Link>
      </section>
    </div>
  )
}

export function DevicesPage() {
  const calibratedAt = useMotionStore((state) => state.calibratedAt)
  const calibrationStatus = useMotionStore((state) => state.calibrationStatus)
  const connected = useMotionStore((state) => state.connected)
  const [refreshing, setRefreshing] = useState(false)
  const [snapshot, setSnapshot] = useState<{
    at: number
    sequence: number | null
    upper: IMUReading | null
    fore: IMUReading | null
    upperOk: boolean
    foreOk: boolean
  } | null>(null)

  async function refresh() {
    setRefreshing(true)
    if (!sendMotionCommand('refresh')) reconnectMotionStream()
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    const frame = getLatestMotionFrame()
    const state = useMotionStore.getState()
    setSnapshot({
      at: Date.now(),
      sequence: frame?.sequence ?? null,
      upper: frame?.sensors.upperArm ?? state.upperArm,
      fore: frame?.sensors.forearm ?? state.forearm,
      upperOk: frame?.upperOk ?? state.upperArmSensor,
      foreOk: frame?.foreOk ?? state.forearmSensor,
    })
    setRefreshing(false)
  }

  return (
    <div className="page">
      <header>
        <p className="kicker">Device status</p>
        <h1>Sensors</h1>
        <p className="lede">Upper arm MPU-6050 at 0x68 and forearm MPU-6050 at 0x69. Refresh re-probes both chips on the board.</p>
      </header>
      <section className="sticker" style={{ maxWidth: 560 }}>
        <DevicePanel />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="ghost-btn" disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="candy"
            disabled={!connected || calibrationStatus === 'calibrating'}
            onClick={() => sendMotionCommand('calibrate')}
          >
            {calibrationStatus === 'calibrating' ? 'Calibrating…' : 'Recalibrate'}
          </button>
        </div>
        <p className="quiet">
          Last calibration{' '}
          {calibratedAt
            ? new Date(calibratedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : 'has not been saved yet'}.
        </p>
      </section>
      <MpuDebugPanel snapshot={snapshot} />
    </div>
  )
}

export function DevLabPage() {
  return (
    <div className="page">
      <header>
        <p className="kicker">Developer lab</p>
        <h1>Digital twin tests</h1>
        <p className="lede">Each page isolates one subsystem. Patients never need these names.</p>
      </header>
      {NAV.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <div className="card-grid">
            {group.items.map((item) => (
              <Link key={item.to} to={item.to} className="sticker exercise-card">
                <span className="pill">{item.kicker}</span>
                <h3>{item.label}</h3>
                <p className="quiet">{item.blurb}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
