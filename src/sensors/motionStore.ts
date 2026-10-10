import { create } from 'zustand'
import type {
  CalibrationStatusMessage,
  DeviceStatusMessage,
  IMUReading,
  MotionFrameMessage,
  MotionMessage,
  QuaternionData,
} from './types.ts'

export type MotionStatus =
  | 'reconnecting'
  | 'live'
  | 'sensor_lost'
  | 'calibrating'

type MotionState = {
  connected: boolean
  status: MotionStatus
  source: string | null
  upperArm: IMUReading | null
  forearm: IMUReading | null
  upperArmQuaternion: QuaternionData | null
  forearmQuaternion: QuaternionData | null
  elbowAngle: number | null
  shoulderAngle: number | null
  wristAngle: number | null
  sampleRate: number
  packetLoss: number
  upperArmSensor: boolean
  forearmSensor: boolean
  handSensor: boolean
  battery: number | null
  charging: boolean
  chargeState: string
  batteryVoltage: number | null
  deviceName: string | null
  signalQuality: string
  calibrated: boolean
  calibrationStatus: CalibrationStatusMessage['status']
  calibratedAt: number | null
  lastFrameAt: number | null
  lastError: string | null
  recording: boolean
}

const INITIAL: MotionState = {
  connected: false,
  status: 'reconnecting',
  source: null,
  upperArm: null,
  forearm: null,
  upperArmQuaternion: null,
  forearmQuaternion: null,
  elbowAngle: null,
  shoulderAngle: null,
  wristAngle: null,
  sampleRate: 0,
  packetLoss: 0,
  upperArmSensor: false,
  forearmSensor: false,
  handSensor: false,
  battery: null,
  charging: false,
  chargeState: 'unknown',
  batteryVoltage: null,
  deviceName: null,
  signalQuality: 'missing',
  calibrated: false,
  calibrationStatus: 'not_calibrated',
  calibratedAt: null,
  lastFrameAt: null,
  lastError: null,
  recording: false,
}

export const useMotionStore = create<MotionState>(() => ({ ...INITIAL }))

let latestFrame: MotionFrameMessage | null = null
let previousSequence: number | null = null
let receivedPackets = 0
let lostPackets = 0
let lastUiPublish = 0
let sessionStartedAt = 0
let dropoutStarted: number | null = null
let dropoutSec = 0
let dropoutRep: number | null = null

export function getLatestMotionFrame() {
  return latestFrame
}

export function beginSessionLink() {
  previousSequence = null
  receivedPackets = 0
  lostPackets = 0
  sessionStartedAt = Date.now()
  dropoutStarted = null
  dropoutSec = 0
  dropoutRep = null
}

export function getSessionLink() {
  const state = useMotionStore.getState()
  const elapsed = Math.max(0.001, (Date.now() - (sessionStartedAt || Date.now())) / 1000)
  const inferred = receivedPackets / elapsed
  const openDropout = dropoutStarted !== null ? (Date.now() - dropoutStarted) / 1000 : 0
  return {
    connected: state.connected,
    upperOk: state.upperArmSensor,
    forearmOk: state.forearmSensor,
    sampleRateHz: state.sampleRate > 1 ? state.sampleRate : inferred,
    packetLossPct: (lostPackets / Math.max(1, lostPackets + receivedPackets)) * 100,
    calibrated: state.calibrated,
    dropoutSec: dropoutSec + openDropout,
    dropoutRep,
  }
}

export function setSocketConnected(connected: boolean) {
  if (connected) {
    previousSequence = null
    receivedPackets = 0
    lostPackets = 0
    useMotionStore.setState({
      connected: true,
      status: 'reconnecting',
      packetLoss: 0,
      lastError: null,
    })
    return
  }
  useMotionStore.setState({
    connected: false,
    status: 'reconnecting',
    upperArmSensor: false,
    forearmSensor: false,
    handSensor: false,
    signalQuality: 'missing',
  })
}

export function setCalibrating() {
  useMotionStore.setState({
    calibrationStatus: 'calibrating',
    status: 'calibrating',
    lastError: null,
  })
}

export function processMotionMessage(message: MotionMessage) {
  if (message.type === 'motion_frame') {
    processFrame(message)
  } else if (message.type === 'device_status') {
    processDeviceStatus(message)
  } else if (message.type === 'calibration_status') {
    const complete = message.status === 'complete'
    useMotionStore.setState({
      calibrationStatus: message.status,
      calibrated: complete || useMotionStore.getState().calibrated,
      calibratedAt: complete ? (message.timestamp ?? Date.now()) : null,
      status:
        message.status === 'calibrating'
          ? 'calibrating'
          : deviceReady()
            ? 'live'
            : 'sensor_lost',
      lastError: message.status === 'failed' ? (message.message ?? 'Calibration failed') : null,
    })
  } else if (message.type === 'error') {
    useMotionStore.setState({ lastError: message.message })
  } else if (message.type === 'recording_status') {
    useMotionStore.setState({ recording: message.status === 'recording' })
  }
}

function processFrame(frame: MotionFrameMessage) {
  latestFrame = frame
  receivedPackets += 1
  if (previousSequence !== null && frame.sequence > previousSequence + 1) {
    lostPackets += frame.sequence - previousSequence - 1
  }
  previousSequence = frame.sequence
  const now = Date.now()
  const upperOk = frame.upperOk ?? true
  const foreOk = frame.foreOk ?? true
  if (!upperOk || !foreOk) {
    if (dropoutStarted === null) dropoutStarted = now
  } else if (dropoutStarted !== null) {
    dropoutSec += (now - dropoutStarted) / 1000
    if (dropoutRep === null) dropoutRep = 1
    dropoutStarted = null
  }
  const loss = (lostPackets / Math.max(1, lostPackets + receivedPackets)) * 100
  if (now - lastUiPublish < 100) return
  lastUiPublish = now
  const state = useMotionStore.getState()
  useMotionStore.setState({
    upperArm: frame.sensors.upperArm,
    forearm: frame.sensors.forearm,
    upperArmQuaternion:
      frame.orientation?.upperArm ?? state.upperArmQuaternion,
    forearmQuaternion:
      frame.orientation?.forearm ?? state.forearmQuaternion,
    elbowAngle: frame.joints?.elbowFlexion ?? state.elbowAngle,
    shoulderAngle: frame.joints?.shoulderFlexion ?? state.shoulderAngle,
    wristAngle: frame.joints?.wristFlexion ?? state.wristAngle,
    packetLoss: Number(loss.toFixed(2)),
    lastFrameAt: now,
    upperArmSensor: frame.upperOk ?? true,
    forearmSensor: frame.foreOk ?? true,
    battery: frame.battery ?? state.battery,
    charging: frame.charging ?? state.charging,
    chargeState: frame.chargeState ?? state.chargeState,
    batteryVoltage: frame.batteryVoltage ?? state.batteryVoltage,
    signalQuality: state.signalQuality === 'missing' ? 'good' : state.signalQuality,
    status: state.connected ? 'live' : 'reconnecting',
  })
}

function processDeviceStatus(status: DeviceStatusMessage) {
  useMotionStore.setState({
    source: status.source ?? null,
    upperArmSensor: status.upperArmSensor,
    forearmSensor: status.forearmSensor,
    handSensor: status.handSensor ?? false,
    sampleRate: status.sampleRate,
    battery: status.battery ?? useMotionStore.getState().battery,
    charging: status.charging ?? useMotionStore.getState().charging,
    chargeState: status.chargeState ?? useMotionStore.getState().chargeState,
    batteryVoltage: status.batteryVoltage ?? useMotionStore.getState().batteryVoltage,
    deviceName: status.deviceName ?? useMotionStore.getState().deviceName,
    signalQuality: status.signalQuality ?? 'unknown',
    calibrated: status.calibrated ?? useMotionStore.getState().calibrated,
    status:
      status.upperArmSensor && status.forearmSensor ? 'live' : 'sensor_lost',
  })
}

function deviceReady() {
  const state = useMotionStore.getState()
  return state.connected && state.upperArmSensor && state.forearmSensor
}

export function markMotionTimedOut(now = Date.now()) {
  const state = useMotionStore.getState()
  if (!state.connected) return
  if (state.lastFrameAt === null || now - state.lastFrameAt > 1_250) {
    useMotionStore.setState({
      status: 'sensor_lost',
      upperArmSensor: false,
      forearmSensor: false,
      signalQuality: 'missing',
    })
  }
}

export function resetMotionStore() {
  latestFrame = null
  previousSequence = null
  receivedPackets = 0
  lostPackets = 0
  lastUiPublish = 0
  sessionStartedAt = 0
  dropoutStarted = null
  dropoutSec = 0
  dropoutRep = null
  useMotionStore.setState({ ...INITIAL }, true)
}
