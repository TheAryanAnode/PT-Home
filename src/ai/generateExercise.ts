import { EXERCISES, regionFor } from '../motion/exercises.ts'
import {
  REST_ANGLES,
  fillAngles,
  isLegFocus,
  type Exercise,
  type ExerciseFocus,
  type JointAngles,
} from '../motion/types.ts'

const MODELS = ['gemini-3.8-flash', 'gemini-flash-latest']

const LIMITS = {
  shoulderFlexion: { min: -20, max: 160 },
  shoulderAbduction: { min: 0, max: 150 },
  elbowFlexion: { min: 0, max: 150 },
  wristFlexion: { min: -60, max: 70 },
  hipFlexion: { min: -10, max: 120 },
  hipAbduction: { min: 0, max: 50 },
  kneeFlexion: { min: 0, max: 140 },
  ankleFlexion: { min: -40, max: 40 },
} as const

const FOCUSES: ExerciseFocus[] = ['elbow', 'shoulder', 'wrist', 'hip', 'knee', 'ankle']

const ARM_KEYS: (keyof JointAngles)[] = ['shoulderFlexion', 'shoulderAbduction', 'elbowFlexion', 'wristFlexion']
const LEG_KEYS: (keyof JointAngles)[] = ['hipFlexion', 'hipAbduction', 'kneeFlexion', 'ankleFlexion']

const SYSTEM = `You design physical-therapy exercises for a 3D humanoid. Every keyframe MUST include ALL eight joint angles in degrees.

Joint meanings:
- shoulderFlexion: -20 to 160 (0 arm hanging, 90 reaching forward)
- shoulderAbduction: 0 to 150 (0 at the side, 90 arm out to the side)
- elbowFlexion: 0 to 150 (5 nearly straight, 90 right angle)
- wristFlexion: -60 to 70 (0 neutral)
- hipFlexion: -10 to 120 (0 standing, 90 thigh toward the chest)
- hipAbduction: 0 to 50 (0 standing, 40 leg out to the side)
- kneeFlexion: 0 to 140 (5 nearly straight, 90 right angle, 95 is a squat)
- ankleFlexion: -40 to 40 (0 flat, positive toes up, negative rise onto the toes)

Return ONLY JSON:
{
  "name": "short exercise name",
  "purpose": "one sentence the patient will read",
  "focus": "elbow" | "shoulder" | "wrist" | "hip" | "knee" | "ankle",
  "laterality": "uni" | "bi",
  "region": "anatomy region",
  "reps": 8,
  "hold": 2,
  "tolerance": 12,
  "duration": 5,
  "limit": { "min": 0, "max": 110 },
  "cues": "one coaching cue",
  "keyframes": [
    { "time": 0, "angles": { "shoulderFlexion": 8, "shoulderAbduction": 10, "elbowFlexion": 8, "wristFlexion": 0, "hipFlexion": 6, "hipAbduction": 0, "kneeFlexion": 8, "ankleFlexion": 4 } },
    { "time": 2.4, "angles": { "shoulderFlexion": 12, "shoulderAbduction": 10, "elbowFlexion": 8, "wristFlexion": 0, "hipFlexion": 80, "hipAbduction": 0, "kneeFlexion": 95, "ankleFlexion": 16 } },
    { "time": 5, "angles": { "shoulderFlexion": 8, "shoulderAbduction": 10, "elbowFlexion": 8, "wristFlexion": 0, "hipFlexion": 6, "hipAbduction": 0, "kneeFlexion": 8, "ankleFlexion": 4 } }
  ]
}

The example above is a squat. Match the REQUEST, not the example:
- Squat / sit-to-stand / lower body: focus "knee", laterality "bi". Stand ≈ hip 6 knee 8. Bottom ≈ hip 70-90 AND knee 80-110 together. Arms stay nearly still.
- Heel raise: focus "ankle", laterality "bi". Knee stays ~6. Peak ankleFlexion about -30.
- Straight-leg raise: focus "hip", laterality "uni". Knee stays ~8. Peak hipFlexion 50-70.
- Hamstring curl: focus "knee", laterality "uni". Hip stays ~8. Peak kneeFlexion ~100.
- Shoulder raise: focus "shoulder". Legs stay at rest (hip 0, knee 5).
- Elbow curl: focus "elbow". Legs stay at rest.

Rules:
- 3 to 6 keyframes. time starts at 0 and increases.
- First and last poses are a comfortable start so the movement can loop.
- The focus joint MUST change by at least 35° (20° for wrist/ankle). Non-focus region stays near rest.
- duration equals the last keyframe time (3 to 8 seconds).
- reps 6-16, hold 0-4, tolerance 8-18.
- laterality is "bi" for squat, sit-to-stand, and heel raise; otherwise "uni".
- Safe rehab motion. No neck/spine, no jumping.`

export type GeneratedExercise = Exercise & { purpose: string }

export async function generateExerciseFromPrompt(prompt: string): Promise<GeneratedExercise> {
  const text = prompt.trim()
  if (text.length < 8) {
    throw new Error('Describe the movement in a bit more detail.')
  }
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!key) {
    throw new Error('Gemini API key is missing. Add VITE_GEMINI_API_KEY to .env.local and restart the app.')
  }
  let lastError = 'Gemini did not return an exercise.'
  for (const model of MODELS) {
    try {
      const raw = await requestModel(model, key, text)
      return normalizeGeneratedExercise(parseJson(raw), text)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError)
}

async function requestModel(model: string, key: string, prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${SYSTEM}\n\nPatient / clinician request:\n${prompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    },
  )
  const body = await response.json() as {
    error?: { message?: string }
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  if (!response.ok) {
    throw new Error(body.error?.message || `Gemini ${model} failed (${response.status})`)
  }
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
  if (!text.trim()) throw new Error('Gemini returned an empty exercise.')
  return text
}

function parseJson(raw: string) {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const payload = fenced ? fenced[1] : trimmed
  return JSON.parse(payload) as Record<string, unknown>
}

export function exerciseIdFromName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
  return `${slug || 'exercise'}-${Date.now().toString(36)}`
}

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pickNum(item: Record<string, unknown>, names: string[], fallback: number) {
  for (const name of names) {
    if (typeof item[name] === 'number' && Number.isFinite(item[name])) return item[name] as number
  }
  return fallback
}

function anglesOf(value: unknown): JointAngles {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const nested = item.angles && typeof item.angles === 'object' ? (item.angles as Record<string, unknown>) : item
  return fillAngles({
    shoulderFlexion: clamp(pickNum(nested, ['shoulderFlexion', 'shoulder_flexion', 'shoulder'], REST_ANGLES.shoulderFlexion), LIMITS.shoulderFlexion.min, LIMITS.shoulderFlexion.max),
    shoulderAbduction: clamp(pickNum(nested, ['shoulderAbduction', 'shoulder_abduction', 'abduction'], REST_ANGLES.shoulderAbduction), LIMITS.shoulderAbduction.min, LIMITS.shoulderAbduction.max),
    elbowFlexion: clamp(pickNum(nested, ['elbowFlexion', 'elbow_flexion', 'elbow'], REST_ANGLES.elbowFlexion), LIMITS.elbowFlexion.min, LIMITS.elbowFlexion.max),
    wristFlexion: clamp(pickNum(nested, ['wristFlexion', 'wrist_flexion', 'wrist'], REST_ANGLES.wristFlexion), LIMITS.wristFlexion.min, LIMITS.wristFlexion.max),
    hipFlexion: clamp(pickNum(nested, ['hipFlexion', 'hip_flexion', 'hip'], REST_ANGLES.hipFlexion), LIMITS.hipFlexion.min, LIMITS.hipFlexion.max),
    hipAbduction: clamp(pickNum(nested, ['hipAbduction', 'hip_abduction'], REST_ANGLES.hipAbduction), LIMITS.hipAbduction.min, LIMITS.hipAbduction.max),
    kneeFlexion: clamp(pickNum(nested, ['kneeFlexion', 'knee_flexion', 'knee'], REST_ANGLES.kneeFlexion), LIMITS.kneeFlexion.min, LIMITS.kneeFlexion.max),
    ankleFlexion: clamp(pickNum(nested, ['ankleFlexion', 'ankle_flexion', 'ankle'], REST_ANGLES.ankleFlexion), LIMITS.ankleFlexion.min, LIMITS.ankleFlexion.max),
  })
}

function spanOf(frames: { angles: JointAngles }[], key: keyof JointAngles) {
  const values = frames.map((frame) => frame.angles[key])
  return Math.max(...values) - Math.min(...values)
}

function regionSpan(frames: { angles: JointAngles }[], keys: (keyof JointAngles)[]) {
  return Math.max(0, ...keys.map((key) => spanOf(frames, key)))
}

export function inferFocusFromText(text: string): ExerciseFocus | null {
  const t = text.toLowerCase()
  if (/squat|sit[\s-]?to[\s-]?stand|stand from (a )?sit|chair stand|lower body|leg press/.test(t)) return 'knee'
  if (/heel raise|calf raise|plantar|rise onto/.test(t)) return 'ankle'
  if (/ankle pump|dorsi|foot up|toes up/.test(t)) return 'ankle'
  if (/hamstring curl|heel to (the )?(seat|butt|glute)/.test(t)) return 'knee'
  if (/knee extension|terminal knee|quad set|kick the (lower )?leg/.test(t)) return 'knee'
  if (/straight[\s-]?leg|slr|hip flex/.test(t)) return 'hip'
  if (/hip abduct|side leg|clamshell|leg out to the side/.test(t)) return 'hip'
  if (/\bmarch/.test(t)) return 'hip'
  if (/\blunge\b/.test(t)) return 'knee'
  if (/wrist|carpal/.test(t)) return 'wrist'
  if (/shoulder|frozen|rotator|scaption|pendulum|deltoid/.test(t)) return 'shoulder'
  if (/elbow|bicep|tricep|curl/.test(t)) return 'elbow'
  return null
}

function focusFromSpans(frames: { angles: JointAngles }[]): ExerciseFocus {
  const ranked = FOCUSES.map((focus) => ({
    focus,
    span: focus === 'shoulder'
      ? Math.max(spanOf(frames, 'shoulderFlexion'), spanOf(frames, 'shoulderAbduction'))
      : focus === 'hip'
        ? Math.max(spanOf(frames, 'hipFlexion'), spanOf(frames, 'hipAbduction'))
        : spanOf(frames, focus === 'elbow' ? 'elbowFlexion' : focus === 'wrist' ? 'wristFlexion' : focus === 'knee' ? 'kneeFlexion' : 'ankleFlexion'),
  })).sort((a, b) => b.span - a.span)
  return ranked[0]?.focus ?? 'elbow'
}

function lateralityFromText(text: string, focus: ExerciseFocus) {
  if (/both legs|bilateral|squat|sit[\s-]?to[\s-]?stand|heel raise|calf raise/.test(text.toLowerCase())) return 'bi' as const
  if (!isLegFocus(focus)) return 'uni' as const
  return 'uni' as const
}

function templateFor(text: string, focus: ExerciseFocus, laterality: 'uni' | 'bi'): Exercise {
  const t = text.toLowerCase()
  const pick = (id: string) => EXERCISES.find((item) => item.id === id)
  if (/sit[\s-]?to[\s-]?stand|chair stand/.test(t)) return pick('sit-to-stand') ?? pick('mini-squat')!
  if (/squat|lower body/.test(t)) return pick('bodyweight-squat') ?? pick('mini-squat')!
  if (/heel raise|calf raise/.test(t)) return pick('heel-raise')!
  if (/ankle pump|dorsi/.test(t)) return pick('ankle-pumps')!
  if (/hamstring curl/.test(t)) return pick('hamstring-curl')!
  if (/knee extension/.test(t)) return pick('seated-knee-extension')!
  if (/straight[\s-]?leg|slr/.test(t)) return pick('straight-leg-raise')!
  if (/hip abduct|side leg|clamshell/.test(t)) return pick('hip-abduction')!
  if (/\bmarch/.test(t)) return pick('marching')!
  if (focus === 'knee' && laterality === 'bi') return pick('bodyweight-squat') ?? pick('mini-squat')!
  if (focus === 'knee') return pick('hamstring-curl')!
  if (focus === 'hip') return pick('straight-leg-raise')!
  if (focus === 'ankle' && laterality === 'bi') return pick('heel-raise')!
  if (focus === 'ankle') return pick('ankle-pumps')!
  if (focus === 'shoulder') return pick('shoulder-flexion')!
  if (focus === 'wrist') return pick('wrist-flexion')!
  return pick('elbow-flexion')!
}

function requestedPeak(text: string, focus: ExerciseFocus, fallback: number) {
  const match = text.match(/(\d{2,3})\s*(?:°|deg|degree)?/)
  if (!match) return fallback
  const value = Number(match[1])
  if (focus === 'ankle') return clamp(value > 0 && /toes|dorsi/.test(text.toLowerCase()) ? value : -Math.abs(value), -40, 40)
  return clamp(value, 20, 140)
}

function primaryKey(focus: ExerciseFocus, frames: { angles: JointAngles }[]): keyof JointAngles {
  if (focus === 'shoulder') return spanOf(frames, 'shoulderAbduction') >= spanOf(frames, 'shoulderFlexion') ? 'shoulderAbduction' : 'shoulderFlexion'
  if (focus === 'hip') return spanOf(frames, 'hipAbduction') >= spanOf(frames, 'hipFlexion') ? 'hipAbduction' : 'hipFlexion'
  if (focus === 'wrist') return 'wristFlexion'
  if (focus === 'ankle') return 'ankleFlexion'
  if (focus === 'knee') return 'kneeFlexion'
  return 'elbowFlexion'
}

function scaleTemplate(template: Exercise, peak: number): { time: number; angles: JointAngles }[] {
  const keys = isLegFocus(template.focus) ? LEG_KEYS : ARM_KEYS
  const key = primaryKey(template.focus, template.keyframes)
  const origin = template.keyframes[0]?.angles ?? REST_ANGLES
  const nativePeak = template.keyframes.reduce((best, frame) => (
    Math.abs(frame.angles[key] - origin[key]) > Math.abs(best - origin[key]) ? frame.angles[key] : best
  ), origin[key])
  const delta = nativePeak - origin[key]
  const scale = Math.abs(delta) < 1 ? 1 : clamp((peak - origin[key]) / delta, 0.45, 1.35)
  return template.keyframes.map((frame) => {
    const angles = { ...frame.angles }
    for (const joint of keys) {
      const from = origin[joint]
      angles[joint] = clamp(from + (frame.angles[joint] - from) * scale, LIMITS[joint].min, LIMITS[joint].max)
    }
    return { time: frame.time, angles: fillAngles(angles) }
  })
}

function quietOtherRegion(frames: { time: number; angles: JointAngles }[], focus: ExerciseFocus) {
  const restArm = { shoulderFlexion: 8, shoulderAbduction: 10, elbowFlexion: 8, wristFlexion: 0 }
  const restLeg = { hipFlexion: REST_ANGLES.hipFlexion, hipAbduction: REST_ANGLES.hipAbduction, kneeFlexion: REST_ANGLES.kneeFlexion, ankleFlexion: REST_ANGLES.ankleFlexion }
  return frames.map((frame) => ({
    time: frame.time,
    angles: fillAngles(isLegFocus(focus)
      ? { ...frame.angles, ...restArm, hipFlexion: frame.angles.hipFlexion, hipAbduction: frame.angles.hipAbduction, kneeFlexion: frame.angles.kneeFlexion, ankleFlexion: frame.angles.ankleFlexion }
      : { ...frame.angles, ...restLeg }),
  }))
}

function keyframesMatchFocus(frames: { angles: JointAngles }[], focus: ExerciseFocus) {
  const minSpan = focus === 'wrist' || focus === 'ankle' || focus === 'hip' ? 18 : 30
  const focusSpan = focus === 'shoulder'
    ? Math.max(spanOf(frames, 'shoulderFlexion'), spanOf(frames, 'shoulderAbduction'))
    : focus === 'hip'
      ? Math.max(spanOf(frames, 'hipFlexion'), spanOf(frames, 'hipAbduction'))
      : spanOf(frames, focus === 'elbow' ? 'elbowFlexion' : focus === 'wrist' ? 'wristFlexion' : focus === 'knee' ? 'kneeFlexion' : 'ankleFlexion')
  const other = isLegFocus(focus) ? regionSpan(frames, ARM_KEYS) : regionSpan(frames, LEG_KEYS)
  if (focus === 'knee' && spanOf(frames, 'kneeFlexion') < 25) return false
  return focusSpan >= minSpan && focusSpan >= other * 0.45
}

export function normalizeGeneratedExercise(raw: Record<string, unknown>, prompt: string): GeneratedExercise {
  const name = String(raw.name || '').trim() || 'Generated exercise'
  const blob = `${prompt} ${name} ${String(raw.purpose || '')}`
  const framesIn = Array.isArray(raw.keyframes) ? raw.keyframes : []
  let keyframes = framesIn
    .map((frame, index) => {
      const row = frame && typeof frame === 'object' ? (frame as Record<string, unknown>) : {}
      return {
        time: Math.max(0, num(row.time, index * 1.5)),
        angles: anglesOf(row.angles ?? row),
      }
    })
    .sort((a, b) => a.time - b.time)

  const textFocus = inferFocusFromText(blob)
  const rawFocus = FOCUSES.includes(raw.focus as ExerciseFocus) ? raw.focus as ExerciseFocus : null
  const spanFocus = keyframes.length >= 2 ? focusFromSpans(keyframes) : null
  const squatLike = /squat|sit[\s-]?to[\s-]?stand|lower body/.test(blob.toLowerCase())
  const focus: ExerciseFocus = textFocus ?? rawFocus ?? spanFocus ?? 'elbow'
  const laterality = squatLike || /heel raise|calf raise/.test(blob.toLowerCase())
    ? 'bi' as const
    : raw.laterality === 'bi' || raw.laterality === 'uni'
      ? raw.laterality
      : lateralityFromText(blob, focus)

  const matches = keyframes.length >= 2 && keyframesMatchFocus(keyframes, focus)
  const squatLooksWrong = squatLike && (spanOf(keyframes, 'kneeFlexion') < 35 || spanOf(keyframes, 'hipFlexion') < 20)
  if (!matches || squatLooksWrong) {
    const template = templateFor(blob, focus, laterality)
    const peak = requestedPeak(blob, focus, template.limit.max)
    keyframes = scaleTemplate(template, peak)
  } else {
    keyframes = quietOtherRegion(keyframes, focus)
  }

  keyframes[0].time = 0
  const duration = Math.max(2, keyframes[keyframes.length - 1].time, num(raw.duration, 4))
  keyframes[keyframes.length - 1].time = duration
  const peak = Math.max(...keyframes.map((frame) => {
    if (focus === 'shoulder') return Math.max(frame.angles.shoulderAbduction, frame.angles.shoulderFlexion)
    if (focus === 'wrist') return frame.angles.wristFlexion
    if (focus === 'hip') return Math.max(frame.angles.hipFlexion, frame.angles.hipAbduction)
    if (focus === 'knee') return frame.angles.kneeFlexion
    if (focus === 'ankle') return frame.angles.ankleFlexion
    return frame.angles.elbowFlexion
  }))
  return {
    id: exerciseIdFromName(name),
    name: /squat/i.test(blob) && !/squat/i.test(name) ? 'Bodyweight squat' : name,
    purpose: String(raw.purpose || '').trim() || `Practice this movement: ${prompt.slice(0, 80)}`,
    duration,
    focus,
    laterality,
    region: String(raw.region || regionFor(focus)),
    limit: {
      min: clamp(num((raw.limit as { min?: number } | undefined)?.min, 0), -40, 40),
      max: clamp(num((raw.limit as { max?: number } | undefined)?.max, Math.round(peak)), 20, 160),
    },
    reps: clamp(Math.round(num(raw.reps, 10)), 4, 20),
    hold: clamp(num(raw.hold, 2), 0, 5),
    tolerance: clamp(num(raw.tolerance, 12), 5, 25),
    cues: String(raw.cues || '').trim() || undefined,
    keyframes,
  }
}
