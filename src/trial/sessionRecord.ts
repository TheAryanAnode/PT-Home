import { shortDate } from './math.ts'
import type { AssessmentRecord, SessionRecord } from './types.ts'

export function toSessionRecord(record: AssessmentRecord): SessionRecord {
  return {
    id: record.id,
    date: shortDate(record.sessionDate),
    name: record.exerciseName,
    exerciseId: record.exerciseId,
    reps: record.endpoints.validReps,
    repGoal: record.qc.repsRequired,
    score: record.formScore,
    rom: Math.round(record.endpoints.maxRom),
    target: Math.round(record.targetRom),
    smoothness: Math.round(record.endpoints.smoothness * 100),
    compensation: Math.round(record.qc.qualityScore),
    shoulderExtra: Math.round(record.endpoints.compensationAngle),
  }
}

export function historyForParticipant(records: AssessmentRecord[], participantId: string): SessionRecord[] {
  return records
    .filter((record) => record.participantId === participantId)
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    .map(toSessionRecord)
}
