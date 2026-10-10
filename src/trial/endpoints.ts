import { clamp, mean, round, stdev } from './math.ts'
import { scoreQuality } from './quality.ts'
import type { AssessmentRecord, DigitalEndpoints, RawSession } from './types.ts'

/**
 * raw session → feature extraction → endpoint record
 * Candidate digital endpoints for longitudinal motor research.
 */
export function extractEndpoints(raw: RawSession): DigitalEndpoints {
  const angles = raw.samples.map((sample) => sample.angle)
  const speeds = raw.samples.map((sample) => Math.abs(sample.velocity))
  const comps = raw.samples.map((sample) => Math.abs(sample.compensation))
  const peaks = repPeaks(angles)
  const validReps = Math.max(raw.repsCompleted, 0)
  const jerk = smoothnessFromJerk(raw)
  return {
    maxRom: round(angles.length ? Math.max(...angles) : 0, 1),
    minRom: round(angles.length ? Math.min(...angles) : 0, 1),
    meanRom: round(mean(peaks.length ? peaks : angles), 1),
    peakVelocity: round(speeds.length ? Math.max(...speeds) : 0, 1),
    meanVelocity: round(mean(speeds), 1),
    meanRepTime: round(validReps > 0 ? raw.durationSec / validReps : raw.durationSec, 2),
    holdDuration: round(raw.holdSec, 1),
    smoothness: round(jerk, 2),
    compensationAngle: round(comps.length ? Math.max(...comps) : 0, 1),
    interRepVariability: round(stdev(peaks), 1),
    completionRate: round(raw.repGoal > 0 ? clamp(validReps / raw.repGoal, 0, 1.5) : 0, 2),
    validReps,
  }
}

export function buildAssessment(raw: RawSession, id?: string): AssessmentRecord {
  return {
    id: id ?? `sess-${raw.participantId}-${raw.sessionDate}-${raw.assessmentId}`,
    participantId: raw.participantId,
    participantCode: raw.participantCode,
    assessmentId: raw.assessmentId,
    exerciseId: raw.exerciseId,
    exerciseName: raw.exerciseName,
    sessionDate: raw.sessionDate,
    week: raw.week,
    baseline: false,
    endpoints: extractEndpoints(raw),
    qc: scoreQuality(raw),
    formScore: raw.formScore,
    targetRom: raw.targetRom,
  }
}

function repPeaks(angles: number[]) {
  if (angles.length < 3) return angles.slice()
  const peaks: number[] = []
  for (let i = 1; i < angles.length - 1; i += 1) {
    if (angles[i] >= angles[i - 1] && angles[i] >= angles[i + 1] && angles[i] > 20) {
      peaks.push(angles[i])
    }
  }
  return peaks.length ? peaks : [Math.max(...angles)]
}

function smoothnessFromJerk(raw: RawSession) {
  const samples = raw.samples
  if (samples.length < 4) return 0.7
  let accel = 0
  for (let i = 1; i < samples.length - 1; i += 1) {
    accel += Math.abs(samples[i + 1].velocity - 2 * samples[i].velocity + samples[i - 1].velocity)
  }
  const meanAccel = accel / Math.max(1, samples.length - 2)
  return clamp(1 - meanAccel / 80, 0.05, 0.99)
}
