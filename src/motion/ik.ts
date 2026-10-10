import * as THREE from 'three'
import { createArm, type ArmPose, type Side } from './types.ts'
import { FORE_LEN, SHOULDER, UPPER_LEN } from '../rig/layout.ts'

const _down = new THREE.Vector3(0, -1, 0)

export type IkSolve = {
  arm: ArmPose
  elbowFlexion: number
  reached: THREE.Vector3
  clamped: boolean
  errorCm: number
}

export function solveArmIk(target: THREE.Vector3, side: Side): IkSolve {
  const shoulder = new THREE.Vector3(SHOULDER[side][0], SHOULDER[side][1], SHOULDER[side][2])
  const offset = target.clone().sub(shoulder)
  if (offset.lengthSq() < 1e-6) offset.set(0, -1, 0.2)
  const rawDist = offset.length()
  const max = UPPER_LEN + FORE_LEN - 0.001
  const min = Math.abs(UPPER_LEN - FORE_LEN) + 0.001
  const dist = THREE.MathUtils.clamp(rawDist, min, max)
  const clamped = Math.abs(rawDist - dist) > 0.004
  const dir = offset.multiplyScalar(1 / rawDist)
  const clampedTarget = shoulder.clone().add(dir.clone().multiplyScalar(dist))

  const cosShoulder = THREE.MathUtils.clamp(
    (UPPER_LEN * UPPER_LEN + dist * dist - FORE_LEN * FORE_LEN) / (2 * UPPER_LEN * dist),
    -1,
    1,
  )
  const shoulderBend = Math.acos(cosShoulder)
  const cosElbow = THREE.MathUtils.clamp(
    (UPPER_LEN * UPPER_LEN + FORE_LEN * FORE_LEN - dist * dist) / (2 * UPPER_LEN * FORE_LEN),
    -1,
    1,
  )
  const flexion = Math.PI - Math.acos(cosElbow)

  const pole = new THREE.Vector3(side === 'right' ? 0.25 : -0.25, -0.15, 1).normalize()
  const axis = new THREE.Vector3().crossVectors(dir, pole)
  if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0)
  axis.normalize()

  const candidates = [1, -1].map((sign) => {
    const upperDir = dir.clone().applyAxisAngle(axis, sign * shoulderBend).normalize()
    const elbowPos = shoulder.clone().add(upperDir.clone().multiplyScalar(UPPER_LEN))
    const polePoint = shoulder.clone().add(pole)
    return { upperDir, elbowPos, rank: elbowPos.distanceTo(polePoint) }
  })
  candidates.sort((a, b) => a.rank - b.rank)
  const upperDir = candidates[0].upperDir
  const elbowPos = candidates[0].elbowPos
  const foreDir = clampedTarget.clone().sub(elbowPos).normalize()

  const qUpper = new THREE.Quaternion().setFromUnitVectors(_down, upperDir)
  const localFore = foreDir.clone().applyQuaternion(qUpper.clone().invert())
  if (localFore.lengthSq() < 1e-8) localFore.copy(_down)
  const qFore = new THREE.Quaternion().setFromUnitVectors(_down, localFore.normalize())

  const reached = elbowPos.clone().add(foreDir.clone().multiplyScalar(FORE_LEN))
  return {
    arm: createArm({
      upper: [qUpper.x, qUpper.y, qUpper.z, qUpper.w],
      fore: [qFore.x, qFore.y, qFore.z, qFore.w],
      hand: [0, 0, 0, 1],
    }),
    elbowFlexion: THREE.MathUtils.radToDeg(flexion),
    reached,
    clamped,
    errorCm: reached.distanceTo(clampedTarget) * 100,
  }
}
