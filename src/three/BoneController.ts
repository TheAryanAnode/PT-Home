import { createArm, type ArmPose } from '../motion/types.ts'
import type { MotionFrameMessage, QuaternionData } from '../sensors/types.ts'

function copyQuaternion(target: QuaternionData, source: QuaternionData) {
  const length = Math.hypot(source[0], source[1], source[2], source[3]) || 1
  target[0] = source[0] / length
  target[1] = source[1] / length
  target[2] = source[2] / length
  target[3] = source[3] / length
}

/** Copies only available orientations. Missing data deliberately holds the last pose. */
export function applyMotionFrameToPose(
  pose: ArmPose,
  frame: MotionFrameMessage,
) {
  if (frame.orientation?.upperArm) {
    copyQuaternion(pose.upper, frame.orientation.upperArm)
  }
  if (frame.orientation?.forearm) {
    copyQuaternion(pose.fore, frame.orientation.forearm)
  }
}

export function createLiveArmPose() {
  return createArm()
}
