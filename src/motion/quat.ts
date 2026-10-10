import * as THREE from 'three'
import { ANGLE_KEYS, REST_ANGLES, type ArmPose, type JointAngles, type Quat4, type Side } from './types.ts'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function ease(t: number) {
  const u = clamp(t, 0, 1)
  return 0.5 - 0.5 * Math.cos(Math.PI * u)
}

export function lerpAngles(a: JointAngles, b: JointAngles, t: number): JointAngles {
  const out = { ...REST_ANGLES }
  for (const key of ANGLE_KEYS) {
    out[key] = lerp(a[key] ?? REST_ANGLES[key], b[key] ?? REST_ANGLES[key], t)
  }
  return out
}

function tuple(q: THREE.Quaternion): Quat4 {
  return [q.x, q.y, q.z, q.w]
}

export function quatFromEuler(xDeg: number, yDeg: number, zDeg: number): Quat4 {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(xDeg * DEG, yDeg * DEG, zDeg * DEG, 'XYZ'),
  )
  return tuple(q)
}

/**
 * Clinical angles → bone-local quaternions.
 * Limb rest pose points down local -Y.
 * Hip/shoulder flexion is a negative X rotation (toward +Z, the front).
 * Knee flexion is a positive X rotation (heel toward the seat, toward -Z).
 * Ankle dorsiflexion is a negative X rotation (toes up).
 * Abduction is a Z rotation away from the body.
 */
export function poseFromAngles(angles: JointAngles, side: Side): ArmPose {
  const sign = side === 'right' ? 1 : -1
  const abd = sign * (angles.shoulderAbduction ?? 0)
  const hipAbd = sign * (angles.hipAbduction ?? 0)
  return {
    upper: quatFromEuler(-(angles.shoulderFlexion ?? 0), 0, abd),
    fore: quatFromEuler(-(angles.elbowFlexion ?? 0), 0, 0),
    hand: quatFromEuler(-(angles.wristFlexion ?? 0), 0, 0),
    thigh: quatFromEuler(-(angles.hipFlexion ?? 0), 0, hipAbd),
    shin: quatFromEuler(angles.kneeFlexion ?? 0, 0, 0),
    foot: quatFromEuler(-(angles.ankleFlexion ?? 0), 0, 0),
  }
}

export function anglesFromArm(arm: ArmPose, side: Side): JointAngles {
  const sign = side === 'right' ? 1 : -1
  const upper = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arm.upper), 'XYZ')
  const fore = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arm.fore), 'XYZ')
  const hand = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arm.hand), 'XYZ')
  const thigh = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arm.thigh), 'XYZ')
  const shin = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arm.shin), 'XYZ')
  const foot = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(arm.foot), 'XYZ')
  return {
    shoulderFlexion: -upper.x * RAD,
    shoulderAbduction: sign * upper.z * RAD,
    elbowFlexion: -fore.x * RAD,
    wristFlexion: -hand.x * RAD,
    hipFlexion: -thigh.x * RAD,
    hipAbduction: sign * thigh.z * RAD,
    kneeFlexion: shin.x * RAD,
    ankleFlexion: -foot.x * RAD,
  }
}

export function quatAngleDeg(a: Quat4, b: Quat4) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])
  return 2 * Math.acos(clamp(dot, 0, 1)) * RAD
}

export function relativeQuat(parent: Quat4, child: Quat4): Quat4 {
  const q = new THREE.Quaternion().fromArray(parent).invert().multiply(new THREE.Quaternion().fromArray(child))
  return tuple(q)
}

/** Rotation magnitude of a quaternion, in degrees. */
export function quatMagnitudeDeg(q: Quat4) {
  return 2 * Math.acos(clamp(Math.abs(q[3]), 0, 1)) * RAD
}

export function multiplyQuat(a: Quat4, b: Quat4): Quat4 {
  const q = new THREE.Quaternion().fromArray(a).multiply(new THREE.Quaternion().fromArray(b))
  return tuple(q)
}

export function invertQuat(q: Quat4): Quat4 {
  const out = new THREE.Quaternion().fromArray(q).invert()
  return tuple(out)
}

export function roundQuat(q: Quat4, digits = 2): Quat4 {
  const f = 10 ** digits
  return q.map((v) => Math.round(v * f) / f) as Quat4
}

export function errorColor(deg: number) {
  if (deg < 5) return '#3ecf8e'
  if (deg < 15) return '#e6b325'
  return '#e85d4c'
}

export function segmentErrors(patient: ArmPose, target: ArmPose) {
  return {
    upper: quatAngleDeg(patient.upper, target.upper),
    fore: quatAngleDeg(patient.fore, target.fore),
    hand: quatAngleDeg(patient.hand, target.hand),
  }
}

export function matchPercent(patient: ArmPose, target: ArmPose) {
  const e = segmentErrors(patient, target)
  const score = (err: number) => clamp(1 - err / 35, 0, 1)
  return Math.round(((score(e.upper) + score(e.fore) + score(e.hand)) / 3) * 100)
}
