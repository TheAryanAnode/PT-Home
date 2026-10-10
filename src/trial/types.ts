export type QualityStatus = 'valid' | 'review' | 'invalid'
export type CheckResult = 'pass' | 'warn' | 'fail'

export type QualityCheck = {
  id: string
  label: string
  result: CheckResult
  detail: string
}

export type MotionQC = {
  sampleRateHz: number
  packetLossPct: number
  repsDone: number
  repsRequired: number
  dropoutSec: number
  checks: QualityCheck[]
  qualityScore: number
  status: QualityStatus
  reviewReasons: string[]
}

export type DigitalEndpoints = {
  maxRom: number
  minRom: number
  meanRom: number
  peakVelocity: number
  meanVelocity: number
  meanRepTime: number
  holdDuration: number
  smoothness: number
  compensationAngle: number
  interRepVariability: number
  completionRate: number
  validReps: number
}

export type AngleSample = {
  t: number
  angle: number
  velocity: number
  compensation: number
}

export type SessionLink = {
  connected: boolean
  upperOk: boolean
  forearmOk: boolean
  sampleRateHz: number
  packetLossPct: number
  calibrated: boolean
  dropoutSec: number
  dropoutRep?: number | null
}

export type RawSession = {
  participantId: string
  participantCode: string
  assessmentId: string
  exerciseId: string
  exerciseName: string
  sessionDate: string
  week: number
  repGoal: number
  holdSec: number
  repsCompleted: number
  formScore: number
  targetRom: number
  durationSec: number
  link: SessionLink
  samples: AngleSample[]
}

export type AssessmentRecord = {
  id: string
  participantId: string
  participantCode: string
  assessmentId: string
  exerciseId: string
  exerciseName: string
  sessionDate: string
  week: number
  baseline: boolean
  endpoints: DigitalEndpoints
  qc: MotionQC
  formScore: number
  targetRom: number
}

export const PRIMARY_ASSESSMENT = 'elbow-flexion-v1'
export const PROTOCOL_VISITS = 9
export const STUDY_EXPECTED_SESSIONS = 90

/** Patient-facing session summary derived from an assessment. */
export type SessionRecord = {
  id: string
  date: string
  name: string
  exerciseId: string
  reps: number
  repGoal: number
  score: number
  rom: number
  target: number
  smoothness: number
  compensation: number
  shoulderExtra: number
}
