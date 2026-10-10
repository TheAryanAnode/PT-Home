import type { Exercise, JointAngles } from './types.ts'
import { clamp } from './quat.ts'
import { focusKey, peakFocus } from './exercises.ts'

export type ScoreParts = {
  range: number
  accuracy: number
  smoothness: number
  compensation: number
  total: number
}

export function combineScore(parts: Omit<ScoreParts, 'total'>): ScoreParts {
  const total = Math.round(
    0.3 * parts.range + 0.3 * parts.accuracy + 0.2 * parts.smoothness + 0.2 * parts.compensation,
  )
  return { ...parts, total: clamp(total, 0, 100) }
}

export type ScoreSample = {
  patient: JointAngles
  ideal: JointAngles
}

export function scoreWindow(samples: ScoreSample[], exercise: Exercise, peak: number): ScoreParts {
  const key = focusKey(exercise)
  const target = peakFocus(exercise)
  const range = clamp(100 - Math.abs(peak - target) * 1.6, 0, 100)
  if (samples.length < 2) {
    return combineScore({ range, accuracy: 100, smoothness: 100, compensation: 100 })
  }
  let absErr = 0
  let comp = 0
  const series: number[] = []
  for (const sample of samples) {
    absErr += Math.abs(sample.patient[key] - sample.ideal[key])
    series.push(sample.patient[key])
    if (exercise.focus === 'elbow') {
      comp = Math.max(comp, Math.abs(sample.patient.shoulderFlexion - sample.ideal.shoulderFlexion))
    } else if (exercise.focus === 'hip') {
      comp = Math.max(comp, Math.abs((sample.patient.kneeFlexion ?? 0) - (sample.ideal.kneeFlexion ?? 0)))
    } else if (exercise.focus === 'knee' || exercise.focus === 'ankle') {
      comp = Math.max(comp, Math.abs((sample.patient.hipFlexion ?? 0) - (sample.ideal.hipFlexion ?? 0)))
    } else {
      comp = Math.max(comp, Math.abs(sample.patient.elbowFlexion - sample.ideal.elbowFlexion))
    }
  }
  const accuracy = clamp(100 - (absErr / samples.length) * 2.4, 0, 100)
  let accel = 0
  for (let i = 1; i < series.length - 1; i += 1) {
    accel += Math.abs(series[i + 1] - 2 * series[i] + series[i - 1])
  }
  const meanAccel = accel / Math.max(1, series.length - 2)
  const smoothness = clamp(100 - meanAccel * 18, 0, 100)
  const compensation = comp <= 10 ? 100 : clamp(100 - (comp - 10) * 4.5, 0, 100)
  return combineScore({
    range: Math.round(range),
    accuracy: Math.round(accuracy),
    smoothness: Math.round(smoothness),
    compensation: Math.round(compensation),
  })
}

export function createRepCounter(bands: () => { high: number; low: number }) {
  let armed = false
  let reps = 0
  let peak = 0
  return {
    push(value: number) {
      const { high, low } = bands()
      peak = Math.max(peak, value)
      if (value >= high) armed = true
      if (armed && value <= low) {
        reps += 1
        armed = false
      }
      return reps
    },
    peak: () => peak,
    reps: () => reps,
    reset() {
      armed = false
      reps = 0
      peak = 0
    },
  }
}
