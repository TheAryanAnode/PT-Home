export type Side = 'right' | 'left'

export type JointId = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle'

/** x, y, z, w */
export type Quat4 = [number, number, number, number]

export type JointAngles = {
  shoulderFlexion: number
  shoulderAbduction: number
  elbowFlexion: number
  wristFlexion: number
  hipFlexion: number
  hipAbduction: number
  kneeFlexion: number
  ankleFlexion: number
}

export const ANGLE_KEYS: (keyof JointAngles)[] = [
  'shoulderFlexion',
  'shoulderAbduction',
  'elbowFlexion',
  'wristFlexion',
  'hipFlexion',
  'hipAbduction',
  'kneeFlexion',
  'ankleFlexion',
]

export type ArmPose = {
  upper: Quat4
  fore: Quat4
  hand: Quat4
  thigh: Quat4
  shin: Quat4
  foot: Quat4
}

export type ExerciseFocus = 'elbow' | 'shoulder' | 'wrist' | 'hip' | 'knee' | 'ankle'

export type Exercise = {
  id: string
  name: string
  purpose?: string
  duration: number
  focus: ExerciseFocus
  region: string
  /** Configured exercise limit for the focus joint, in degrees. */
  limit: { min: number; max: number }
  keyframes: { time: number; angles: JointAngles }[]
  reps?: number
  hold?: number
  /** Allowed difference from the target pose, in degrees. */
  tolerance?: number
  conditions?: string[]
  cues?: string
  /** Bilateral moves (squat, heel raise) drive both legs. */
  laterality?: 'uni' | 'bi'
}

export type MotionSource = 'live' | 'manual' | 'ik' | 'exercise' | 'replay'

export const IDENTITY_QUAT: Quat4 = [0, 0, 0, 1]

export function createArm(partial?: Partial<ArmPose>): ArmPose {
  return {
    upper: partial?.upper ? [...partial.upper] : [...IDENTITY_QUAT],
    fore: partial?.fore ? [...partial.fore] : [...IDENTITY_QUAT],
    hand: partial?.hand ? [...partial.hand] : [...IDENTITY_QUAT],
    thigh: partial?.thigh ? [...partial.thigh] : [...IDENTITY_QUAT],
    shin: partial?.shin ? [...partial.shin] : [...IDENTITY_QUAT],
    foot: partial?.foot ? [...partial.foot] : [...IDENTITY_QUAT],
  }
}

export function writeArm(dst: ArmPose, src: ArmPose) {
  for (let i = 0; i < 4; i += 1) {
    dst.upper[i] = src.upper[i]
    dst.fore[i] = src.fore[i]
    dst.hand[i] = src.hand[i]
    dst.thigh[i] = src.thigh[i]
    dst.shin[i] = src.shin[i]
    dst.foot[i] = src.foot[i]
  }
}

export function cloneAngles(a: JointAngles): JointAngles {
  return { ...REST_ANGLES, ...a }
}

export const REST_ANGLES: JointAngles = {
  shoulderFlexion: 0,
  shoulderAbduction: 10,
  elbowFlexion: 5,
  wristFlexion: 0,
  hipFlexion: 0,
  hipAbduction: 0,
  kneeFlexion: 5,
  ankleFlexion: 0,
}

export const READY_ANGLES: JointAngles = {
  shoulderFlexion: 22,
  shoulderAbduction: 24,
  elbowFlexion: 32,
  wristFlexion: 4,
  hipFlexion: 0,
  hipAbduction: 0,
  kneeFlexion: 8,
  ankleFlexion: 0,
}

export function fillAngles(partial?: Partial<JointAngles> | null): JointAngles {
  return { ...REST_ANGLES, ...partial }
}

export function isLegFocus(focus: ExerciseFocus) {
  return focus === 'hip' || focus === 'knee' || focus === 'ankle'
}
