import { round, signed } from './math.ts'
import {
  PRIMARY_ASSESSMENT,
  STUDY_EXPECTED_SESSIONS,
  type AssessmentRecord,
  type DigitalEndpoints,
  type QualityStatus,
} from './types.ts'

export type EndpointDelta = {
  rom: number
  smoothness: number
  compensation: number
}

export type BaselineCompare = {
  assessmentId: string
  exerciseName: string
  baseline: AssessmentRecord
  current: AssessmentRecord
  change: EndpointDelta
  adherence: { done: number; expected: number }
  latestQuality: number
}

export type StudyOverview = {
  participants: number
  completed: number
  expected: number
  adherence: number
  valid: number
  review: number
  invalid: number
  change: EndpointDelta
}

export function markBaselines(records: AssessmentRecord[]): AssessmentRecord[] {
  const seen = new Set<string>()
  return [...records]
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.id.localeCompare(b.id))
    .map((record) => {
      const key = `${record.participantId}:${record.assessmentId}`
      const isFirstValid = record.qc.status === 'valid' && !seen.has(key)
      if (isFirstValid) seen.add(key)
      return { ...record, baseline: isFirstValid }
    })
}

export function recordsFor(records: AssessmentRecord[], participantId: string, assessmentId?: string) {
  return records
    .filter((record) => record.participantId === participantId)
    .filter((record) => (assessmentId ? record.assessmentId === assessmentId : true))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
}

export function compareToBaseline(
  records: AssessmentRecord[],
  participantId: string,
  assessmentId = PRIMARY_ASSESSMENT,
): BaselineCompare | null {
  const rows = recordsFor(records, participantId, assessmentId)
  const baseline = rows.find((row) => row.baseline) ?? rows.find((row) => row.qc.status === 'valid')
  const current =
    [...rows].reverse().find((row) => row.qc.status === 'valid') ?? rows[rows.length - 1]
  if (!baseline || !current) return null
  return {
    assessmentId,
    exerciseName: current.exerciseName,
    baseline,
    current,
    change: delta(baseline.endpoints, current.endpoints),
    adherence: { done: rows.length, expected: 9 },
    latestQuality: current.qc.qualityScore,
  }
}

export function studyOverview(records: AssessmentRecord[], participantCount: number): StudyOverview {
  const protocol = records.filter((record) => record.assessmentId === PRIMARY_ASSESSMENT)
  const valid = protocol.filter((record) => record.qc.status === 'valid').length
  const review = protocol.filter((record) => record.qc.status === 'review').length
  const invalid = protocol.filter((record) => record.qc.status === 'invalid').length
  const expected = STUDY_EXPECTED_SESSIONS
  const completed = protocol.length
  const participants = new Set(protocol.map((record) => record.participantId))
  const changes: EndpointDelta[] = []
  for (const id of participants) {
    const compared = compareToBaseline(records, id)
    if (compared) changes.push(compared.change)
  }
  return {
    participants: participantCount || participants.size,
    completed,
    expected,
    adherence: expected ? Math.round((completed / expected) * 100) : 0,
    valid,
    review,
    invalid,
    change: {
      rom: round(meanOf(changes.map((item) => item.rom)), 1),
      smoothness: round(meanOf(changes.map((item) => item.smoothness)), 2),
      compensation: round(meanOf(changes.map((item) => item.compensation)), 1),
    },
  }
}

export function delta(from: DigitalEndpoints, to: DigitalEndpoints): EndpointDelta {
  return {
    rom: round(to.maxRom - from.maxRom, 1),
    smoothness: round(to.smoothness - from.smoothness, 2),
    compensation: round(to.compensationAngle - from.compensationAngle, 1),
  }
}

export function statusLabel(status: QualityStatus) {
  if (status === 'valid') return 'VALID'
  if (status === 'review') return 'REVIEW REQUIRED'
  return 'INVALID'
}

export function formatChange(value: number, kind: 'rom' | 'smooth' | 'comp') {
  if (kind === 'smooth') return signed(value * 100, 0, '%')
  if (kind === 'comp') return signed(value, 1, '°')
  return signed(value, 1, '°')
}

function meanOf(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
