import { useEffect, useState } from 'react'
import { getLatestMotionFrame, useMotionStore } from '../sensors/motionStore.ts'
import type { IMUReading } from '../sensors/types.ts'

type Snapshot = {
  at: number
  sequence: number | null
  upper: IMUReading | null
  fore: IMUReading | null
  upperOk: boolean
  foreOk: boolean
}

const EMPTY: IMUReading = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 }

export function MpuDebugPanel({ snapshot }: { snapshot: Snapshot | null }) {
  const [, setTick] = useState(0)
  const storeUpper = useMotionStore((state) => state.upperArm)
  const storeFore = useMotionStore((state) => state.forearm)
  const storeUpperOk = useMotionStore((state) => state.upperArmSensor)
  const storeForeOk = useMotionStore((state) => state.forearmSensor)
  const lastFrameAt = useMotionStore((state) => state.lastFrameAt)
  const sampleHz = useMotionStore((state) => state.sampleRate)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 50)
    return () => window.clearInterval(id)
  }, [])

  const frame = getLatestMotionFrame()
  const upper = frame?.sensors.upperArm ?? storeUpper
  const fore = frame?.sensors.forearm ?? storeFore
  const upperOk = frame?.upperOk ?? storeUpperOk
  const foreOk = frame?.foreOk ?? storeForeOk
  const ageMs = frame ? Math.max(0, Date.now() - frame.timestamp) : lastFrameAt ? Date.now() - lastFrameAt : null

  return (
    <section className="stack">
      <header className="page-head" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="kicker">MPU debug</p>
          <h2>Both IMUs</h2>
          <p className="quiet">
            0x68 is upper arm (AD0 to GND). 0x69 is forearm (AD0 to 3V).
            Still, |a| should sit near 9.81 m/s² and |g| near 0.
          </p>
        </div>
        <p className="quiet mono">
          seq {frame?.sequence ?? '—'} · {sampleHz ? `${sampleHz.toFixed(1)} Hz` : 'no stream'} · {ageMs == null ? 'stale' : `${ageMs} ms ago`}
        </p>
      </header>
      <div className="pair">
        <MpuCard
          title="Upper arm"
          address="0x68"
          ok={upperOk}
          reading={upper}
          snapshot={snapshot?.upper ?? null}
          snapshotOk={snapshot?.upperOk}
        />
        <MpuCard
          title="Forearm"
          address="0x69"
          ok={foreOk}
          reading={fore}
          snapshot={snapshot?.fore ?? null}
          snapshotOk={snapshot?.foreOk}
        />
      </div>
      {snapshot ? (
        <p className="quiet">
          Snapshot at {new Date(snapshot.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          {snapshot.sequence != null ? ` · seq ${snapshot.sequence}` : ''}. Live values keep moving; the frozen row is the refresh.
        </p>
      ) : null}
    </section>
  )
}

function MpuCard({
  title,
  address,
  ok,
  reading,
  snapshot,
  snapshotOk,
}: {
  title: string
  address: string
  ok: boolean
  reading: IMUReading | null
  snapshot: IMUReading | null
  snapshotOk?: boolean
}) {
  const live = reading ?? EMPTY
  const magA = magnitude(live.ax, live.ay, live.az)
  const magG = magnitude(live.gx, live.gy, live.gz)
  return (
    <article className={`sticker mpu-card${ok ? '' : ' missing'}`}>
      <div className="battery-head">
        <div>
          <p className="kicker">{address}</p>
          <h2>{title}</h2>
        </div>
        <span className={`charge-pill${ok ? ' full' : ''}`}>{ok ? 'Live' : 'Missing'}</span>
      </div>
      <div className="mpu-axes mono">
        <span />
        <span>accel m/s²</span>
        <span>gyro rad/s</span>
        <span>x</span>
        <strong>{fmt(live.ax)}</strong>
        <strong>{fmt(live.gx)}</strong>
        <span>y</span>
        <strong>{fmt(live.ay)}</strong>
        <strong>{fmt(live.gy)}</strong>
        <span>z</span>
        <strong>{fmt(live.az)}</strong>
        <strong>{fmt(live.gz)}</strong>
        <span>|v|</span>
        <strong>{fmt(magA)}</strong>
        <strong>{fmt(magG)}</strong>
      </div>
      {snapshot ? (
        <div className="formula mono">
          <div>refresh {snapshotOk === false ? 'missing' : 'ok'}</div>
          <div>a {fmt(snapshot.ax)} {fmt(snapshot.ay)} {fmt(snapshot.az)}</div>
          <div>g {fmt(snapshot.gx)} {fmt(snapshot.gy)} {fmt(snapshot.gz)}</div>
        </div>
      ) : null}
    </article>
  )
}

function magnitude(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z)
}

function fmt(value: number) {
  return value.toFixed(3)
}
