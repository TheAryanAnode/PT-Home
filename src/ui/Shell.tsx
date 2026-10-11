import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useMotionStore } from '../sensors/motionStore.ts'
import { useMotionStream } from '../sensors/useMotionStream.ts'
import { useRehab } from '../store/rehabStore.ts'
import { batteryCaption, DevicePanel, sensorLabel, sensorTone } from './DevicePanel.tsx'
import { IconExercises, IconGear, IconHome, IconPencil, IconPeople, IconPlay, IconProgress } from './icons.tsx'

export function Shell() {
  useMotionStream()
  const mode = useRehab((state) => state.viewerMode)
  const motionConnected = useMotionStore((state) => state.connected)
  const motionStatus = useMotionStore((state) => state.status)
  const battery = useMotionStore((state) => state.battery)
  const charging = useMotionStore((state) => state.charging)
  const chargeState = useMotionStore((state) => state.chargeState)
  const [open, setOpen] = useState(false)
  const tone = sensorTone(motionConnected, motionStatus)
  const liveLabel =
    motionConnected && motionStatus === 'live' && battery !== null
      ? batteryCaption(battery, charging, chargeState)
      : sensorLabel(motionConnected, motionStatus)
  const items = mode === 'patient'
    ? [
        { to: '/', label: 'Home', icon: <IconHome />, end: true },
        { to: '/session/setup', label: 'Session', icon: <IconPlay />, end: false },
        { to: '/exercises', label: 'Exercises', icon: <IconExercises />, end: false },
        { to: '/progress', label: 'Progress', icon: <IconProgress />, end: false },
      ]
    : [
        { to: '/clinician', label: 'Patients', icon: <IconPeople />, end: true },
        { to: '/study', label: 'Study', icon: <IconProgress />, end: false },
        { to: '/exercises', label: 'Exercises', icon: <IconExercises />, end: false },
        { to: '/clinician/builder', label: 'Exercise Builder', icon: <IconPencil />, end: false },
      ]

  return (
    <div className="app-shell">
      <aside className="nav-side">
        <Link to={mode === 'patient' ? '/' : '/clinician'} className="brand">
          <span className="brand-mark">PT</span>
          <span>
            <strong>PT@Home</strong>
            <small>{mode === 'patient' ? 'Today’s therapy' : 'Clinician view'}</small>
          </span>
        </Link>
        <ModeSwitch />
        <nav>
          <p className="nav-label">{mode === 'patient' ? 'You' : 'Clinic'}</p>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link on' : 'nav-link')}
            >
              <span className="bubble">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-foot">
          {open ? (
            <div className="sticker sensor-pop">
              <p className="kicker">Device status</p>
              <DevicePanel compact />
              <Link to="/settings/devices" className="ghost-btn" onClick={() => setOpen(false)}>
                Open device page
              </Link>
            </div>
          ) : null}
          <button type="button" className={`sensor-chip ${tone === 'ok' ? '' : tone}`} onClick={() => setOpen((value) => !value)}>
            <span className="dot" />
            {liveLabel}
          </button>
          <Link to="/settings" className="gear-link">
            <IconGear size={18} /> Settings
          </Link>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

function ModeSwitch() {
  const mode = useRehab((state) => state.viewerMode)
  const setViewerMode = useRehab((state) => state.setViewerMode)
  return (
    <div className="mode-switch" role="group" aria-label="Who is using PT@Home">
      <button type="button" className={mode === 'patient' ? 'on' : ''} onClick={() => setViewerMode('patient')}>
        Patient
      </button>
      <button type="button" className={mode === 'clinician' ? 'on' : ''} onClick={() => setViewerMode('clinician')}>
        Clinician
      </button>
    </div>
  )
}
