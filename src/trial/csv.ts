import type { AssessmentRecord } from './types.ts'

const HEADER = [
  'participant_id',
  'assessment_id',
  'session_id',
  'date',
  'baseline',
  'max_rom',
  'min_rom',
  'mean_rom',
  'peak_velocity',
  'mean_velocity',
  'mean_rep_time',
  'hold_duration',
  'smoothness',
  'compensation',
  'inter_rep_variability',
  'completion_rate',
  'rep_count',
  'quality_score',
  'valid',
  'status',
  'review_reason',
] as const

export function assessmentRow(record: AssessmentRecord): Record<(typeof HEADER)[number], string | number | boolean> {
  return {
    participant_id: record.participantCode || record.participantId,
    assessment_id: record.assessmentId,
    session_id: record.id,
    date: record.sessionDate,
    baseline: record.baseline,
    max_rom: record.endpoints.maxRom,
    min_rom: record.endpoints.minRom,
    mean_rom: record.endpoints.meanRom,
    peak_velocity: record.endpoints.peakVelocity,
    mean_velocity: record.endpoints.meanVelocity,
    mean_rep_time: record.endpoints.meanRepTime,
    hold_duration: record.endpoints.holdDuration,
    smoothness: record.endpoints.smoothness,
    compensation: record.endpoints.compensationAngle,
    inter_rep_variability: record.endpoints.interRepVariability,
    completion_rate: record.endpoints.completionRate,
    rep_count: record.endpoints.validReps,
    quality_score: record.qc.qualityScore,
    valid: record.qc.status === 'valid',
    status: record.qc.status,
    review_reason: record.qc.reviewReasons[0] ?? '',
  }
}

export function assessmentsToCsv(records: AssessmentRecord[]) {
  const lines = [
    HEADER.join(','),
    ...records.map((record) =>
      HEADER.map((key) => csvCell(assessmentRow(record)[key])).join(','),
    ),
  ]
  return `${lines.join('\n')}\n`
}

export function downloadStudyCsv(records: AssessmentRecord[], filename = 'study-export.csv') {
  const blob = new Blob([assessmentsToCsv(records)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}
