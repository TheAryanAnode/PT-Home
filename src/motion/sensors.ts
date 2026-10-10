import type { ArmPose, JointAngles, Quat4, Side } from './types.ts'
import { ANGLE_KEYS } from './types.ts'
import { poseFromAngles, multiplyQuat, invertQuat, relativeQuat, quatMagnitudeDeg } from './quat.ts'

/**
 * Strap on the lateral / posterior surface of the limb (outside of the arm),
 * not the inner elbow. Mostly a 180° spin about the bone long axis (Y)
 * plus a small unique offset per board so the two IMUs are not identical.
 */
export const MOUNT_OFFSET: ArmPose = {
  upper: [0.06, 0.99, -0.08, 0.09],
  fore: [-0.05, 0.985, 0.1, 0.12],
  hand: [0.04, 0.992, -0.06, 0.1],
  thigh: [0, 0, 0, 1],
  shin: [0, 0, 0, 1],
  foot: [0, 0, 0, 1],
}

function normalizeMount(q: Quat4): Quat4 {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len]
}

export const MOUNTS: ArmPose = {
  upper: normalizeMount(MOUNT_OFFSET.upper),
  fore: normalizeMount(MOUNT_OFFSET.fore),
  hand: normalizeMount(MOUNT_OFFSET.hand),
  thigh: normalizeMount(MOUNT_OFFSET.thigh),
  shin: normalizeMount(MOUNT_OFFSET.shin),
  foot: normalizeMount(MOUNT_OFFSET.foot),
}

export type Calibration = {
  sensor0: ArmPose
  model0: ArmPose
}

export function sensorFromBody(body: ArmPose, mountOn: boolean): ArmPose {
  if (!mountOn) {
    return {
      upper: [...body.upper],
      fore: [...body.fore],
      hand: [...body.hand],
      thigh: [...body.thigh],
      shin: [...body.shin],
      foot: [...body.foot],
    }
  }
  return {
    upper: multiplyQuat(MOUNTS.upper, body.upper),
    fore: multiplyQuat(MOUNTS.fore, body.fore),
    hand: multiplyQuat(MOUNTS.hand, body.hand),
    thigh: [...body.thigh],
    shin: [...body.shin],
    foot: [...body.foot],
  }
}

/**
 * q_body = q_model0 · q_sensor0⁻¹ · q_sensor
 * When the captured model pose matches the real pose at calibration,
 * a constant mount offset cancels.
 */
export function applyCalibration(sensor: ArmPose, cal: Calibration): ArmPose {
  const recover = (now: Quat4, zero: Quat4, model: Quat4) =>
    multiplyQuat(multiplyQuat(model, invertQuat(zero)), now)
  return {
    upper: recover(sensor.upper, cal.sensor0.upper, cal.model0.upper),
    fore: recover(sensor.fore, cal.sensor0.fore, cal.model0.fore),
    hand: recover(sensor.hand, cal.sensor0.hand, cal.model0.hand),
    thigh: [...sensor.thigh],
    shin: [...sensor.shin],
    foot: [...sensor.foot],
  }
}

export function captureCalibration(body: ArmPose, mountOn: boolean): Calibration {
  return {
    sensor0: sensorFromBody(body, mountOn),
    model0: {
      upper: [...body.upper],
      fore: [...body.fore],
      hand: [...body.hand],
      thigh: [...body.thigh],
      shin: [...body.shin],
      foot: [...body.foot],
    },
  }
}

export type FilterState = JointAngles

export function createAngleFilter(initial: JointAngles) {
  const state: JointAngles = { ...initial }
  return (next: JointAngles, alpha: number) => {
    const a = alpha >= 0.999 ? 1 : alpha
    for (const key of ANGLE_KEYS) {
      state[key] += ((next[key] ?? state[key]) - state[key]) * a
    }
    return { ...state }
  }
}

export function jointSeparations(arm: ArmPose) {
  return {
    elbow: quatMagnitudeDeg(relativeQuat(arm.upper, arm.fore)),
    wrist: quatMagnitudeDeg(relativeQuat(arm.fore, arm.hand)),
    shoulder: quatMagnitudeDeg(arm.upper),
  }
}

export function streamMessage(arm: ArmPose, angles: JointAngles, timestamp: number) {
  const q = (value: Quat4) => value.map((n) => Math.round(n * 100) / 100)
  const n = (value: number) => Math.round(value * 10) / 10
  return {
    timestamp: Math.round(timestamp * 1000),
    upperArm: { q: q(arm.upper) },
    forearm: { q: q(arm.fore) },
    hand: { q: q(arm.hand) },
    joints: {
      elbowFlexion: n(angles.elbowFlexion),
      shoulderFlexion: n(angles.shoulderFlexion),
      wristFlexion: n(angles.wristFlexion),
    },
  }
}

export function bodyPose(angles: JointAngles, side: Side) {
  return poseFromAngles(angles, side)
}
