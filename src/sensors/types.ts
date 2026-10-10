export type QuaternionData = [number, number, number, number]

export type IMUReading = {
  ax: number
  ay: number
  az: number
  gx: number
  gy: number
  gz: number
}

export type MotionFrameMessage = {
  type: 'motion_frame'
  timestamp: number
  sequence: number
  sensors: {
    upperArm: IMUReading
    forearm: IMUReading
  }
  orientation?: {
    upperArm?: QuaternionData
    forearm?: QuaternionData
  }
  joints?: {
    elbowFlexion?: number
    shoulderFlexion?: number
    wristFlexion?: number
  }
  battery?: number
  charging?: boolean
  chargeState?: string
  batteryVoltage?: number
  upperOk?: boolean
  foreOk?: boolean
}

export type DeviceStatusMessage = {
  type: 'device_status'
  source?: 'simulator' | 'ble' | string
  bleConnected: boolean
  upperArmSensor: boolean
  forearmSensor: boolean
  handSensor?: boolean
  sampleRate: number
  battery?: number | null
  charging?: boolean
  chargeState?: string
  batteryVoltage?: number | null
  deviceName?: string
  signalQuality?: 'good' | 'poor' | 'missing' | string
  calibrated?: boolean
}

export type CalibrationStatusMessage = {
  type: 'calibration_status'
  status: 'not_calibrated' | 'calibrating' | 'complete' | 'failed'
  timestamp?: number
  message?: string
}

export type BridgeErrorMessage = {
  type: 'error'
  code: string
  message: string
}

export type RecordingStatusMessage = {
  type: 'recording_status'
  status: 'recording' | 'stopped'
  path?: string | null
}

export type MotionMessage =
  | MotionFrameMessage
  | DeviceStatusMessage
  | CalibrationStatusMessage
  | BridgeErrorMessage
  | RecordingStatusMessage

export type MotionCommand =
  | 'calibrate'
  | 'calibration_clear'
  | 'record_start'
  | 'record_stop'
  | 'refresh'

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function reading(value: unknown): value is IMUReading {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['ax', 'ay', 'az', 'gx', 'gy', 'gz'].every((key) => finite(item[key]))
}

function quaternion(value: unknown): value is QuaternionData {
  return Array.isArray(value) && value.length === 4 && value.every(finite)
}

export function parseMotionMessage(raw: string): MotionMessage | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const message = value as Record<string, unknown>
  if (message.type === 'motion_frame') {
    const sensors = message.sensors as Record<string, unknown> | undefined
    if (
      !finite(message.timestamp) ||
      !finite(message.sequence) ||
      !sensors ||
      !reading(sensors.upperArm) ||
      !reading(sensors.forearm)
    ) {
      return null
    }
    const orientation = message.orientation as Record<string, unknown> | undefined
    if (
      orientation &&
      ((orientation.upperArm !== undefined && !quaternion(orientation.upperArm)) ||
        (orientation.forearm !== undefined && !quaternion(orientation.forearm)))
    ) {
      return null
    }
    return value as MotionFrameMessage
  }
  if (message.type === 'device_status') {
    if (
      typeof message.bleConnected !== 'boolean' ||
      typeof message.upperArmSensor !== 'boolean' ||
      typeof message.forearmSensor !== 'boolean' ||
      !finite(message.sampleRate)
    ) {
      return null
    }
    return value as DeviceStatusMessage
  }
  if (message.type === 'calibration_status') {
    return typeof message.status === 'string'
      ? (value as CalibrationStatusMessage)
      : null
  }
  if (message.type === 'error') {
    return typeof message.message === 'string' && typeof message.code === 'string'
      ? (value as BridgeErrorMessage)
      : null
  }
  if (message.type === 'recording_status') {
    return value as RecordingStatusMessage
  }
  return null
}
