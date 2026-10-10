import { addDays, lerp, round } from './math.ts'
import { markBaselines } from './study.ts'
import type { AssessmentRecord, DigitalEndpoints, MotionQC, QualityStatus } from './types.ts'
import { PRIMARY_ASSESSMENT } from './types.ts'

const START = '2026-08-15'

type Issue = { week: number; status: QualityStatus; reason: string; dropout?: number }

type Profile = {
  id: string
  code: string
  startRom: number
  endRom: number
  startSmooth: number
  endSmooth: number
  startComp: number
  endComp: number
  weeks: number[]
  issues?: Issue[]
}

const PROFILES: Profile[] = [
  {
    id: '0142',
    code: 'R-0142',
    startRom: 61,
    endRom: 88,
    startSmooth: 0.68,
    endSmooth: 0.87,
    startComp: 22,
    endComp: 8.3,
    weeks: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    id: '0108',
    code: 'R-0108',
    startRom: 48,
    endRom: 71,
    startSmooth: 0.64,
    endSmooth: 0.79,
    startComp: 18,
    endComp: 11,
    weeks: [0, 1, 2, 3, 4, 5, 6, 7],
    issues: [{ week: 3, status: 'review', reason: 'Packet loss 2.1% during the mid-range of the set.', dropout: 0.8 }],
  },
  {
    id: '0216',
    code: 'R-0216',
    startRom: 55,
    endRom: 63,
    startSmooth: 0.7,
    endSmooth: 0.74,
    startComp: 16,
    endComp: 14,
    weeks: [0, 1, 2, 3, 4, 5, 6],
    issues: [
      { week: 2, status: 'review', reason: 'Forearm signal dropped for 2.4 seconds during rep 4.', dropout: 2.4 },
      { week: 5, status: 'invalid', reason: 'Calibration was not completed.' },
    ],
  },
  extra('0301', 'R-0301', 58, 72, 7),
  extra('0304', 'R-0304', 50, 66, 7),
  extra('0311', 'R-0311', 63, 74, 7),
  extra('0318', 'R-0318', 44, 59, 7),
  extra('0322', 'R-0322', 52, 70, 7, [{ week: 4, status: 'review', reason: 'Sample rate dipped to 38 Hz for part of the session.' }]),
  extra('0329', 'R-0329', 57, 69, 6),
  extra('0335', 'R-0335', 49, 61, 6),
  extra('0341', 'R-0341', 60, 73, 6),
  extra('0348', 'R-0348', 46, 64, 7),
]

function extra(
  id: string,
  code: string,
  start: number,
  end: number,
  count: number,
  issues: Issue[] = [],
): Profile {
  return {
    id,
    code,
    startRom: start,
    endRom: end,
    startSmooth: 0.62,
    endSmooth: 0.8,
    startComp: 17,
    endComp: 10,
    weeks: Array.from({ length: count }, (_, i) => i),
    issues,
  }
}

export function buildSeedAssessments(): AssessmentRecord[] {
  const records: AssessmentRecord[] = []
  for (const profile of PROFILES) {
    const last = Math.max(...profile.weeks, 1)
    for (const week of profile.weeks) {
      const t = week / last
      const issue = profile.issues?.find((item) => item.week === week)
      const endpoints = endpointsAt(profile, t, week)
      const qc = qualityFor(issue, week === 0)
      records.push({
        id: `seed-${profile.id}-w${week}`,
        participantId: profile.id,
        participantCode: profile.code,
        assessmentId: PRIMARY_ASSESSMENT,
        exerciseId: 'elbow-flexion',
        exerciseName: 'Elbow flexion',
        sessionDate: addDays(START, week * 7),
        week,
        baseline: false,
        endpoints,
        qc,
        formScore: Math.round(lerp(70, 91, t)),
        targetRom: 90,
      })
    }
  }
  return markBaselines(records)
}

function endpointsAt(profile: Profile, t: number, week: number): DigitalEndpoints {
  const maxRom = week === 4 && profile.id === '0142' ? 78 : round(lerp(profile.startRom, profile.endRom, t), 1)
  const smoothness = week === 4 && profile.id === '0142' ? 0.84 : round(lerp(profile.startSmooth, profile.endSmooth, t), 2)
  const compensationAngle = week === 4 && profile.id === '0142' ? 11 : round(lerp(profile.startComp, profile.endComp, t), 1)
  return {
    maxRom,
    minRom: round(maxRom * 0.12, 1),
    meanRom: round(maxRom * 0.72, 1),
    peakVelocity: round(48 + t * 18, 1),
    meanVelocity: round(22 + t * 8, 1),
    meanRepTime: round(2.55 - t * 0.3, 2),
    holdDuration: 2,
    smoothness,
    compensationAngle,
    interRepVariability: round(6.4 - t * 2.2, 1),
    completionRate: 1,
    validReps: 8,
  }
}

function qualityFor(issue: Issue | undefined, baseline: boolean): MotionQC {
  if (issue?.status === 'invalid') {
    return packQc('invalid', 38, 51.2, 9.4, 3, 8, 0, [
      ['sensors', 'pass', 'PASS'],
      ['rate', 'pass', '51.2 Hz'],
      ['loss', 'fail', '9.4%'],
      ['cal', 'fail', 'Not completed'],
      ['reps', 'fail', '3 / 8'],
      ['motion', 'warn', 'Incomplete set'],
      ['attach', 'pass', 'PASS'],
      ['noise', 'warn', 'High jerk / noise'],
    ], [issue.reason])
  }
  if (issue?.status === 'review') {
    const drop = issue.dropout ?? 2.4
    return packQc('review', 71, 46.1, 2.1, 8, 8, drop, [
      ['sensors', 'pass', 'PASS'],
      ['rate', 'warn', '46.1 Hz'],
      ['loss', 'warn', '2.1%'],
      ['cal', 'pass', 'PASS'],
      ['reps', 'pass', '8 / 8'],
      ['motion', 'pass', 'PASS'],
      ['attach', 'warn', `Dropout ${drop.toFixed(1)}s`],
      ['noise', 'pass', 'PASS'],
    ], [issue.reason])
  }
  return packQc('valid', baseline ? 94 : 96, 49.7, 0.3, 8, 8, 0, [
    ['sensors', 'pass', 'PASS'],
    ['rate', 'pass', '49.7 Hz'],
    ['loss', 'pass', '0.3%'],
    ['cal', 'pass', 'PASS'],
    ['reps', 'pass', '8 / 8'],
    ['motion', 'pass', 'PASS'],
    ['attach', 'pass', 'PASS'],
    ['noise', 'pass', 'PASS'],
  ], [])
}

function packQc(
  status: QualityStatus,
  qualityScore: number,
  sampleRateHz: number,
  packetLossPct: number,
  repsDone: number,
  repsRequired: number,
  dropoutSec: number,
  rows: [string, 'pass' | 'warn' | 'fail', string][],
  reviewReasons: string[],
): MotionQC {
  const labels: Record<string, string> = {
    sensors: 'Sensor connection',
    rate: 'Sample rate',
    loss: 'Packet loss',
    cal: 'Calibration',
    reps: 'Required reps',
    motion: 'Motion validity',
    attach: 'Sensor attachment',
    noise: 'Signal noise',
  }
  return {
    sampleRateHz,
    packetLossPct,
    repsDone,
    repsRequired,
    dropoutSec,
    qualityScore,
    status,
    reviewReasons,
    checks: rows.map(([id, result, detail]) => ({
      id,
      label: labels[id] ?? id,
      result,
      detail,
    })),
  }
}

export const SEED_ASSESSMENTS = buildSeedAssessments()
