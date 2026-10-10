import {
  useMotionStore,
  type MotionStatus,
} from '../sensors/motionStore.ts'
import { InfoTip } from './InfoTip.tsx'

export function sensorTone(connected: boolean, status: MotionStatus) {
  if (!connected || status === 'reconnecting') return 'bad' as const
  if (status === 'sensor_lost') return 'warn' as const
  return 'ok' as const
}

export function sensorLabel(connected: boolean, status: MotionStatus) {
  if (!connected || status === 'reconnecting') return 'Reconnecting to sensors…'
  if (status === 'sensor_lost') return 'Sensors need attention'
  if (status === 'calibrating') return 'Calibrating sensors…'
  return 'Sensors connected'
}

export function batteryCaption(
  percent: number | null,
  charging: boolean,
  chargeState: string,
) {
  if (percent === null) return 'No battery reading'
  if (chargeState === 'full' || percent >= 99) return 'Full'
  if (charging || chargeState === 'charging') return `Charging · ${percent}%`
  return `${percent}% left`
}

export function DevicePanel({ compact = false }: { compact?: boolean }) {
  const connected = useMotionStore((state) => state.connected)
  const status = useMotionStore((state) => state.status)
  const source = useMotionStore((state) => state.source)
  const deviceName = useMotionStore((state) => state.deviceName)
  const upper = useMotionStore((state) => state.upperArmSensor)
  const fore = useMotionStore((state) => state.forearmSensor)
  const battery = useMotionStore((state) => state.battery)
  const charging = useMotionStore((state) => state.charging)
  const chargeState = useMotionStore((state) => state.chargeState)
  const batteryVoltage = useMotionStore((state) => state.batteryVoltage)
  const sampleHz = useMotionStore((state) => state.sampleRate)
  const packetLoss = useMotionStore((state) => state.packetLoss)
  const quality = useMotionStore((state) => state.signalQuality)
  const calibrated = useMotionStore((state) => state.calibrated)
  const calibratedAt = useMotionStore((state) => state.calibratedAt)
  const lastError = useMotionStore((state) => state.lastError)

  return (
    <div className="stack">
      <BatteryMeter
        percent={battery}
        charging={charging}
        chargeState={chargeState}
        voltage={batteryVoltage}
        compact={compact}
      />
      <div className="check-line">
        <span>Bridge</span>
        <b>{connected ? 'Connected' : 'Reconnecting…'}</b>
      </div>
      <div className="check-line">
        <span>Upper arm</span>
        <b>{upper ? 'Connected' : '—'}</b>
      </div>
      <div className="check-line">
        <span>Forearm</span>
        <b>{fore ? 'Connected' : '—'}</b>
      </div>
      {compact ? null : (
        <>
          <div className="check-line">
            <span>Hand</span>
            <b>Not used</b>
          </div>
          <div className="stat-row">
            <span className="heading-row">
              Source
              <InfoTip label="Connection notes">
                <p>The nRF52832 does not appear in Mac Bluetooth settings. Flash <span className="mono">firmware/RehabMotion</span> and run <span className="mono">python main.py --ble</span>.</p>
                <p>Packet loss and signal quality describe the live IMU stream, not Wi-Fi.</p>
              </InfoTip>
            </span>
            <strong>{source === 'simulator' ? 'Simulator' : source === 'ble' ? deviceName || 'nRF52832' : 'Waiting'}</strong>
          </div>
          <div className="stat-row"><span>Sampling</span><strong>{sampleHz ? `${sampleHz.toFixed(1)} Hz` : '—'}</strong></div>
          <div className="stat-row"><span>Packet loss</span><strong>{packetLoss.toFixed(1)}%</strong></div>
          <div className="stat-row"><span>Signal quality</span><strong>{status === 'sensor_lost' ? 'Paused' : titleCase(quality)}</strong></div>
          <div className="stat-row"><span>Last calibration</span><strong>{calibratedAt ? new Date(calibratedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : calibrated ? 'Complete' : 'Not yet'}</strong></div>
          {lastError ? <p className="attention">{lastError}</p> : null}
        </>
      )}
    </div>
  )
}

function BatteryMeter({
  percent,
  charging,
  chargeState,
  voltage,
  compact,
}: {
  percent: number | null
  charging: boolean
  chargeState: string
  voltage: number | null
  compact: boolean
}) {
  const isCharging = charging || chargeState === 'charging'
  const isFull = chargeState === 'full' || (percent !== null && percent >= 99)
  const width = percent === null ? 0 : Math.max(4, Math.min(100, percent))
  const fillClass = isCharging ? 'charging' : percent !== null && percent <= 20 ? 'low' : ''
  return (
    <div className={`battery-meter${compact ? ' compact' : ''}`}>
      <div className="battery-head">
        <strong>{percent === null ? '—' : `${percent}%`}</strong>
        <span className={`charge-pill${isCharging ? ' on' : isFull ? ' full' : ''}`}>
          {isFull ? 'Full' : isCharging ? 'Charging' : 'On battery'}
        </span>
      </div>
      <div className="battery-shell" aria-hidden="true">
        <div className="battery-body">
          <i className={fillClass} style={{ width: `${width}%` }} />
        </div>
        <span className="battery-nub" />
      </div>
      <p className="quiet">
        {batteryCaption(percent, charging, chargeState)}
        {voltage != null ? ` · ${voltage.toFixed(2)} V` : ''}
      </p>
    </div>
  )
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown'
}

