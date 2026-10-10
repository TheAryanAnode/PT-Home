import { clamp, round } from './math.ts'
import type { CheckResult, MotionQC, QualityCheck, QualityStatus, RawSession } from './types.ts'

function check(id: string, label: string, result: CheckResult, detail: string): QualityCheck {
  return { id, label, result, detail }
}

function scoreOf(result: CheckResult) {
  if (result === 'pass') return 100
  if (result === 'warn') return 62
  return 18
}

/**
 * Rule-based MotionQC. No ML: connection, rate, loss, calibration,
 * reps, plausible ROM, dropouts, and noise.
 */
export function scoreQuality(raw: RawSession): MotionQC {
  const { link, samples, repsCompleted, repGoal } = raw
  const angles = samples.map((sample) => sample.angle)
  const speeds = samples.map((sample) => Math.abs(sample.velocity))
  const span = angles.length ? Math.max(...angles) - Math.min(...angles) : 0
  const peak = speeds.length ? Math.max(...speeds) : 0
  const stuck = samples.length > 8 && span < 8
  const wildRom = angles.some((value) => value < -20 || value > 170)
  const wildSpeed = peak > 420
  const jitter = meanAbsJerk(samples)

  const sensors = link.connected && link.upperOk && link.forearmOk
  const sensorResult: CheckResult = sensors ? 'pass' : link.connected ? 'fail' : 'fail'
  const rate = link.sampleRateHz
  const rateResult: CheckResult = rate >= 45 && rate <= 58 ? 'pass' : rate >= 30 ? 'warn' : 'fail'
  const loss = link.packetLossPct
  const lossResult: CheckResult = loss <= 1 ? 'pass' : loss <= 5 ? 'warn' : 'fail'
  const calResult: CheckResult = link.calibrated ? 'pass' : 'fail'
  const repResult: CheckResult =
    repsCompleted >= repGoal ? 'pass' : repsCompleted >= Math.ceil(repGoal * 0.5) ? 'warn' : 'fail'
  const motionResult: CheckResult = wildRom || wildSpeed || stuck ? 'fail' : span >= 12 ? 'pass' : 'warn'
  const dropResult: CheckResult =
    link.dropoutSec <= 0.4 ? 'pass' : link.dropoutSec <= 2.5 ? 'warn' : 'fail'
  const noiseResult: CheckResult = jitter <= 18 ? 'pass' : jitter <= 36 ? 'warn' : 'fail'

  const checks: QualityCheck[] = [
    check('sensors', 'Sensor connection', sensorResult, sensorResult === 'pass' ? 'PASS' : 'Both IMUs were not live'),
    check('rate', 'Sample rate', rateResult, `${round(rate, 1)} Hz`),
    check('loss', 'Packet loss', lossResult, `${round(loss, 1)}%`),
    check('cal', 'Calibration', calResult, calResult === 'pass' ? 'PASS' : 'Not completed'),
    check('reps', 'Required reps', repResult, `${repsCompleted} / ${repGoal}`),
    check('motion', 'Motion validity', motionResult, motionResult === 'pass' ? 'PASS' : stuck ? 'Range too small' : 'Implausible motion'),
    check('attach', 'Sensor attachment', dropResult, dropResult === 'pass' ? 'PASS' : `Dropout ${round(link.dropoutSec, 1)}s`),
    check('noise', 'Signal noise', noiseResult, noiseResult === 'pass' ? 'PASS' : 'High jerk / noise'),
  ]

  const qualityScore = Math.round(
    checks.reduce((sum, item) => sum + scoreOf(item.result), 0) / checks.length,
  )

  const reasons: string[] = []
  if (!sensors) reasons.push('Upper-arm or forearm sensor was not connected.')
  if (!link.calibrated) reasons.push('Calibration was not completed.')
  if (lossResult === 'fail') reasons.push(`Packet loss ${round(loss, 1)}% exceeded the 5% limit.`)
  if (rateResult === 'fail') reasons.push(`Sample rate ${round(rate, 1)} Hz was unstable.`)
  if (repResult !== 'pass') reasons.push(`Completed ${repsCompleted} of ${repGoal} required reps.`)
  if (motionResult === 'fail') reasons.push('Recorded joint motion was not plausible for this task.')
  if (dropResult !== 'pass') {
    const rep = link.dropoutRep ? ` during rep ${link.dropoutRep}` : ''
    reasons.push(`Forearm signal dropped for ${round(link.dropoutSec, 1)} seconds${rep}.`)
  }
  if (noiseResult === 'fail') reasons.push('IMU noise was excessive relative to a controlled rep.')

  let status: QualityStatus = 'valid'
  if (checks.some((item) => item.result === 'fail' && ['sensors', 'cal', 'loss', 'motion'].includes(item.id))) {
    status = 'invalid'
  } else if (checks.some((item) => item.result !== 'pass')) {
    status = 'review'
  }
  if (qualityScore < 50) status = 'invalid'
  else if (qualityScore < 80 && status === 'valid') status = 'review'

  return {
    sampleRateHz: round(rate, 1),
    packetLossPct: round(loss, 1),
    repsDone: repsCompleted,
    repsRequired: repGoal,
    dropoutSec: round(link.dropoutSec, 1),
    checks,
    qualityScore: clamp(qualityScore, 0, 100),
    status,
    reviewReasons: reasons,
  }
}

function meanAbsJerk(samples: RawSession['samples']) {
  if (samples.length < 3) return 0
  let total = 0
  for (let i = 1; i < samples.length - 1; i += 1) {
    total += Math.abs(samples[i + 1].velocity - 2 * samples[i].velocity + samples[i - 1].velocity)
  }
  return total / (samples.length - 2)
}
