import type { Exercise, ExerciseFocus, JointAngles } from './types.ts'
import { isLegFocus, REST_ANGLES } from './types.ts'
import { ease, lerpAngles } from './quat.ts'

export type RegionHighlight = 'biceps' | 'deltoid' | 'forearm' | 'quad' | 'hamstring' | 'calf' | 'hip'

const FOCUS_KEYS: Record<ExerciseFocus, (keyof JointAngles)[]> = {
  elbow: ['elbowFlexion'],
  shoulder: ['shoulderFlexion', 'shoulderAbduction'],
  wrist: ['wristFlexion'],
  hip: ['hipFlexion', 'hipAbduction'],
  knee: ['kneeFlexion'],
  ankle: ['ankleFlexion'],
}

function pose(partial: Partial<JointAngles>): JointAngles {
  return { ...REST_ANGLES, ...partial }
}

export const EXERCISES: Exercise[] = [
  {
    id: 'elbow-flexion',
    name: 'Elbow flexion',
    purpose: 'Bend and straighten the elbow with the upper arm quiet.',
    duration: 4,
    focus: 'elbow',
    region: 'Biceps region',
    limit: { min: 0, max: 120 },
    reps: 10,
    hold: 2,
    conditions: ['Stroke', 'Fracture recovery', 'Tendinopathy'],
    cues: 'Keep the upper arm at your side. Bend to the target, pause, then lower.',
    keyframes: [
      { time: 0, angles: pose({ elbowFlexion: 5, shoulderAbduction: 12 }) },
      { time: 2, angles: pose({ elbowFlexion: 90, shoulderAbduction: 12 }) },
      { time: 4, angles: pose({ elbowFlexion: 5, shoulderAbduction: 12 }) },
    ],
  },
  {
    id: 'elbow-extension',
    name: 'Elbow extension',
    purpose: 'Practice straightening the elbow from a bent start.',
    duration: 4,
    focus: 'elbow',
    region: 'Triceps region',
    limit: { min: 0, max: 110 },
    reps: 10,
    hold: 2,
    conditions: ['Stroke', 'Fracture recovery', 'Nerve injury'],
    cues: 'Start bent. Smoothly straighten without shoving the shoulder forward.',
    keyframes: [
      { time: 0, angles: pose({ elbowFlexion: 95, shoulderAbduction: 10 }) },
      { time: 2, angles: pose({ elbowFlexion: 12, shoulderAbduction: 10 }) },
      { time: 4, angles: pose({ elbowFlexion: 95, shoulderAbduction: 10 }) },
    ],
  },
  {
    id: 'hand-to-mouth',
    name: 'Hand to mouth',
    purpose: 'A daily-living reach used after stroke and for self-care practice.',
    duration: 5,
    focus: 'elbow',
    region: 'Biceps region',
    limit: { min: 0, max: 130 },
    reps: 8,
    hold: 1,
    conditions: ['Stroke', 'Parkinson’s'],
    cues: 'Bring the hand toward the mouth, then return to the lap. Keep the motion slow.',
    keyframes: [
      { time: 0, angles: pose({ elbowFlexion: 20, shoulderFlexion: 8, shoulderAbduction: 12, wristFlexion: 0 }) },
      { time: 2.4, angles: pose({ elbowFlexion: 118, shoulderFlexion: 36, shoulderAbduction: 14, wristFlexion: 8 }) },
      { time: 5, angles: pose({ elbowFlexion: 20, shoulderFlexion: 8, shoulderAbduction: 12, wristFlexion: 0 }) },
    ],
  },
  {
    id: 'shoulder-abduction',
    name: 'Shoulder abduction',
    purpose: 'Lift the arm out to the side and lower it with control.',
    duration: 4,
    focus: 'shoulder',
    region: 'Deltoid region',
    limit: { min: 0, max: 100 },
    reps: 8,
    hold: 2,
    conditions: ['Frozen shoulder', 'Rotator cuff', 'Stroke'],
    cues: 'Lead with the thumb up. Stop if the shoulder shrugs toward the ear.',
    keyframes: [
      { time: 0, angles: pose({ shoulderAbduction: 10, elbowFlexion: 12 }) },
      { time: 2, angles: pose({ shoulderAbduction: 90, elbowFlexion: 12 }) },
      { time: 4, angles: pose({ shoulderAbduction: 10, elbowFlexion: 12 }) },
    ],
  },
  {
    id: 'shoulder-flexion',
    name: 'Shoulder flexion',
    purpose: 'Raise the arm forward, used for frozen shoulder and post-stroke reach.',
    duration: 5,
    focus: 'shoulder',
    region: 'Deltoid region',
    limit: { min: 0, max: 140 },
    reps: 8,
    hold: 2,
    conditions: ['Frozen shoulder', 'Stroke', 'Parkinson’s'],
    cues: 'Reach forward as if placing a glass on a shelf, then lower.',
    keyframes: [
      { time: 0, angles: pose({ shoulderFlexion: 8, shoulderAbduction: 12, elbowFlexion: 14 }) },
      { time: 2.4, angles: pose({ shoulderFlexion: 110, shoulderAbduction: 16, elbowFlexion: 10 }) },
      { time: 5, angles: pose({ shoulderFlexion: 8, shoulderAbduction: 12, elbowFlexion: 14 }) },
    ],
  },
  {
    id: 'scaption-raise',
    name: 'Scaption raise',
    purpose: 'Raise the arm in the scapular plane, a common rotator-cuff drill.',
    duration: 5,
    focus: 'shoulder',
    region: 'Deltoid region',
    limit: { min: 0, max: 100 },
    reps: 8,
    hold: 2,
    conditions: ['Rotator cuff', 'Tendinopathy'],
    cues: 'Lift about 30° forward of the side. Do not hike the shoulder.',
    keyframes: [
      { time: 0, angles: pose({ shoulderFlexion: 12, shoulderAbduction: 14, elbowFlexion: 10 }) },
      { time: 2.4, angles: pose({ shoulderFlexion: 42, shoulderAbduction: 78, elbowFlexion: 8 }) },
      { time: 5, angles: pose({ shoulderFlexion: 12, shoulderAbduction: 14, elbowFlexion: 10 }) },
    ],
  },
  {
    id: 'pendulum-sway',
    name: 'Pendulum sway',
    purpose: 'Small supported swings used early after rotator-cuff repair or with a stiff shoulder.',
    duration: 4,
    focus: 'shoulder',
    region: 'Deltoid region',
    limit: { min: 0, max: 40 },
    reps: 12,
    hold: 0,
    conditions: ['Rotator cuff', 'Frozen shoulder', 'Post-op'],
    cues: 'Let the arm hang. Rock a little forward and back. Do not muscle the swing.',
    keyframes: [
      { time: 0, angles: pose({ shoulderFlexion: 6, shoulderAbduction: 14, elbowFlexion: 8 }) },
      { time: 1.2, angles: pose({ shoulderFlexion: 22, shoulderAbduction: 18, elbowFlexion: 8 }) },
      { time: 2.4, angles: pose({ shoulderFlexion: 4, shoulderAbduction: 22, elbowFlexion: 8 }) },
      { time: 4, angles: pose({ shoulderFlexion: 6, shoulderAbduction: 14, elbowFlexion: 8 }) },
    ],
  },
  {
    id: 'table-slide',
    name: 'Table slide',
    purpose: 'Slide the arm forward on a surface to regain flexion without lifting against gravity.',
    duration: 5,
    focus: 'shoulder',
    region: 'Deltoid region',
    limit: { min: 0, max: 90 },
    reps: 8,
    hold: 2,
    conditions: ['Frozen shoulder', 'Post-op', 'Fracture recovery'],
    cues: 'Imagine a cloth on a table. Slide out, pause, slide back.',
    keyframes: [
      { time: 0, angles: pose({ shoulderFlexion: 16, shoulderAbduction: 10, elbowFlexion: 28 }) },
      { time: 2.5, angles: pose({ shoulderFlexion: 78, shoulderAbduction: 12, elbowFlexion: 12 }) },
      { time: 5, angles: pose({ shoulderFlexion: 16, shoulderAbduction: 10, elbowFlexion: 28 }) },
    ],
  },
  {
    id: 'wrist-flexion',
    name: 'Wrist flexion',
    purpose: 'Bend the wrist while the elbow stays supported.',
    duration: 4,
    focus: 'wrist',
    region: 'Forearm flexor region',
    limit: { min: -20, max: 70 },
    reps: 10,
    hold: 1,
    conditions: ['Arthritis', 'Tendinopathy', 'Carpal tunnel'],
    cues: 'Rest the forearm. Only the wrist moves.',
    keyframes: [
      { time: 0, angles: pose({ elbowFlexion: 85, shoulderFlexion: 20, shoulderAbduction: 16, wristFlexion: 0 }) },
      { time: 2, angles: pose({ elbowFlexion: 85, shoulderFlexion: 20, shoulderAbduction: 16, wristFlexion: 55 }) },
      { time: 4, angles: pose({ elbowFlexion: 85, shoulderFlexion: 20, shoulderAbduction: 16, wristFlexion: 0 }) },
    ],
  },
  {
    id: 'wrist-extension',
    name: 'Wrist extension',
    purpose: 'Lift the back of the hand, common after wrist fracture and for grip prep.',
    duration: 4,
    focus: 'wrist',
    region: 'Forearm extensor region',
    limit: { min: -50, max: 20 },
    reps: 10,
    hold: 1,
    conditions: ['Fracture recovery', 'Arthritis', 'Tendinopathy'],
    cues: 'Forearm supported. Raise the knuckles, then return to neutral.',
    keyframes: [
      { time: 0, angles: pose({ elbowFlexion: 85, shoulderFlexion: 18, shoulderAbduction: 14, wristFlexion: 0 }) },
      { time: 2, angles: pose({ elbowFlexion: 85, shoulderFlexion: 18, shoulderAbduction: 14, wristFlexion: -40 }) },
      { time: 4, angles: pose({ elbowFlexion: 85, shoulderFlexion: 18, shoulderAbduction: 14, wristFlexion: 0 }) },
    ],
  },
  {
    id: 'big-reach',
    name: 'Large-amplitude reach',
    purpose: 'A big, deliberate reach used in Parkinson’s and post-stroke training.',
    duration: 5,
    focus: 'shoulder',
    region: 'Deltoid region',
    limit: { min: 0, max: 150 },
    reps: 8,
    hold: 1,
    conditions: ['Parkinson’s', 'Stroke'],
    cues: 'Make the movement large and clear. Fully reach, then fully return.',
    keyframes: [
      { time: 0, angles: pose({ shoulderFlexion: 16, shoulderAbduction: 18, elbowFlexion: 42, wristFlexion: 4 }) },
      { time: 2.4, angles: pose({ shoulderFlexion: 128, shoulderAbduction: 28, elbowFlexion: 12, wristFlexion: 0 }) },
      { time: 5, angles: pose({ shoulderFlexion: 16, shoulderAbduction: 18, elbowFlexion: 42, wristFlexion: 4 }) },
    ],
  },
  {
    id: 'assisted-curl',
    name: 'Small biceps curl',
    purpose: 'A shorter-range curl for irritable biceps tendon or early tendon loading.',
    duration: 4,
    focus: 'elbow',
    region: 'Biceps region',
    limit: { min: 20, max: 90 },
    reps: 10,
    hold: 2,
    conditions: ['Tendinopathy', 'Arthritis'],
    cues: 'Stay in a comfortable middle range. No snapping at the top.',
    keyframes: [
      { time: 0, angles: pose({ elbowFlexion: 30, shoulderAbduction: 10 }) },
      { time: 2, angles: pose({ elbowFlexion: 78, shoulderAbduction: 10 }) },
      { time: 4, angles: pose({ elbowFlexion: 30, shoulderAbduction: 10 }) },
    ],
  },
  {
    id: 'mini-squat',
    name: 'Mini squat',
    purpose: 'A small sit-to-stand pattern for knee osteoarthritis and Parkinson’s.',
    duration: 5,
    focus: 'knee',
    region: 'Quadriceps region',
    laterality: 'bi',
    limit: { min: 5, max: 80 },
    reps: 8,
    hold: 2,
    conditions: ['Arthritis', 'Parkinson’s', 'Stroke'],
    cues: 'Hips back, knees over toes. Sit a little, pause, stand tall.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 8, kneeFlexion: 8, ankleFlexion: 4 }) },
      { time: 2.4, angles: pose({ hipFlexion: 55, kneeFlexion: 62, ankleFlexion: 12 }) },
      { time: 5, angles: pose({ hipFlexion: 8, kneeFlexion: 8, ankleFlexion: 4 }) },
    ],
  },
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight squat',
    purpose: 'Sit the hips back and down, then stand tall, a lower-body strength drill.',
    duration: 5,
    focus: 'knee',
    region: 'Quadriceps region',
    laterality: 'bi',
    limit: { min: 5, max: 110 },
    reps: 8,
    hold: 1,
    conditions: ['Arthritis', 'Parkinson’s', 'Stroke'],
    cues: 'Hips back, chest tall. Bend both knees, pause, drive up through the feet.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 6, kneeFlexion: 8, ankleFlexion: 4, shoulderFlexion: 8, elbowFlexion: 8 }) },
      { time: 2.4, angles: pose({ hipFlexion: 82, kneeFlexion: 95, ankleFlexion: 16, shoulderFlexion: 18, elbowFlexion: 10 }) },
      { time: 5, angles: pose({ hipFlexion: 6, kneeFlexion: 8, ankleFlexion: 4, shoulderFlexion: 8, elbowFlexion: 8 }) },
    ],
  },
  {
    id: 'sit-to-stand',
    name: 'Sit to stand',
    purpose: 'Stand up from a chair and sit back down with both legs sharing the work.',
    duration: 6,
    focus: 'knee',
    region: 'Quadriceps region',
    laterality: 'bi',
    limit: { min: 10, max: 100 },
    reps: 8,
    hold: 1,
    conditions: ['Arthritis', 'Stroke', 'Parkinson’s'],
    cues: 'Scoot forward, lean the trunk, stand, then sit with control.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 88, kneeFlexion: 92, ankleFlexion: 12, shoulderFlexion: 16, elbowFlexion: 18 }) },
      { time: 2.8, angles: pose({ hipFlexion: 12, kneeFlexion: 10, ankleFlexion: 4, shoulderFlexion: 8, elbowFlexion: 8 }) },
      { time: 6, angles: pose({ hipFlexion: 88, kneeFlexion: 92, ankleFlexion: 12, shoulderFlexion: 16, elbowFlexion: 18 }) },
    ],
  },
  {
    id: 'straight-leg-raise',
    name: 'Straight-leg raise',
    purpose: 'Lift the straight leg to load the hip flexors and quads after knee surgery or stroke.',
    duration: 5,
    focus: 'hip',
    region: 'Hip flexor region',
    laterality: 'uni',
    limit: { min: 0, max: 70 },
    reps: 8,
    hold: 2,
    conditions: ['Fracture recovery', 'Stroke', 'Arthritis'],
    cues: 'Keep the knee straight. Lift the whole leg, pause, lower slowly.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: 0 }) },
      { time: 2.4, angles: pose({ hipFlexion: 58, kneeFlexion: 8, ankleFlexion: 6 }) },
      { time: 5, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: 0 }) },
    ],
  },
  {
    id: 'hamstring-curl',
    name: 'Standing hamstring curl',
    purpose: 'Bend the knee to bring the heel toward the seat, used after ACL work and for hamstring loading.',
    duration: 4,
    focus: 'knee',
    region: 'Hamstring region',
    laterality: 'uni',
    limit: { min: 0, max: 120 },
    reps: 10,
    hold: 2,
    conditions: ['Fracture recovery', 'Arthritis', 'Stroke'],
    cues: 'Stand tall. Only the lower leg moves. Do not swing the hip forward.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 6, kneeFlexion: 8, ankleFlexion: 0 }) },
      { time: 2, angles: pose({ hipFlexion: 8, kneeFlexion: 105, ankleFlexion: 8 }) },
      { time: 4, angles: pose({ hipFlexion: 6, kneeFlexion: 8, ankleFlexion: 0 }) },
    ],
  },
  {
    id: 'seated-knee-extension',
    name: 'Knee extension',
    purpose: 'Straighten the knee from a bent start, a common quad drill after TKA and for arthritis.',
    duration: 4,
    focus: 'knee',
    region: 'Quadriceps region',
    laterality: 'uni',
    limit: { min: 0, max: 110 },
    reps: 10,
    hold: 2,
    conditions: ['Arthritis', 'Fracture recovery', 'Stroke'],
    cues: 'Start bent. Kick the lower leg out until the knee is nearly straight, then lower.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 18, kneeFlexion: 95, ankleFlexion: 4 }) },
      { time: 2, angles: pose({ hipFlexion: 16, kneeFlexion: 12, ankleFlexion: 0 }) },
      { time: 4, angles: pose({ hipFlexion: 18, kneeFlexion: 95, ankleFlexion: 4 }) },
    ],
  },
  {
    id: 'hip-abduction',
    name: 'Hip abduction',
    purpose: 'Lift the leg out to the side to train the gluteus medius and pelvic stability.',
    duration: 4,
    focus: 'hip',
    region: 'Hip abductor region',
    laterality: 'uni',
    limit: { min: 0, max: 45 },
    reps: 10,
    hold: 2,
    conditions: ['Arthritis', 'Stroke', 'Parkinson’s'],
    cues: 'Keep the pelvis quiet. Lift the straight leg to the side, then lower.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 4, hipAbduction: 4, kneeFlexion: 6 }) },
      { time: 2, angles: pose({ hipFlexion: 6, hipAbduction: 38, kneeFlexion: 6 }) },
      { time: 4, angles: pose({ hipFlexion: 4, hipAbduction: 4, kneeFlexion: 6 }) },
    ],
  },
  {
    id: 'marching',
    name: 'Marching in place',
    purpose: 'A high-step march used for gait prep after stroke and in Parkinson’s amplitude work.',
    duration: 4,
    focus: 'hip',
    region: 'Hip flexor region',
    laterality: 'uni',
    limit: { min: 0, max: 90 },
    reps: 12,
    hold: 0,
    conditions: ['Stroke', 'Parkinson’s'],
    cues: 'Lift the thigh as if marching. Set the foot down quietly.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 8, kneeFlexion: 10, ankleFlexion: 0 }) },
      { time: 1.8, angles: pose({ hipFlexion: 72, kneeFlexion: 78, ankleFlexion: 8 }) },
      { time: 4, angles: pose({ hipFlexion: 8, kneeFlexion: 10, ankleFlexion: 0 }) },
    ],
  },
  {
    id: 'ankle-pumps',
    name: 'Ankle pumps',
    purpose: 'Dorsiflex and return the foot, used after stroke and to keep the ankle moving post-op.',
    duration: 3,
    focus: 'ankle',
    region: 'Ankle dorsiflexor region',
    laterality: 'uni',
    limit: { min: -10, max: 35 },
    reps: 12,
    hold: 1,
    conditions: ['Stroke', 'Fracture recovery', 'Arthritis'],
    cues: 'Keep the knee quiet. Pull the toes up, pause, then relax.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: 0 }) },
      { time: 1.4, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: 28 }) },
      { time: 3, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: 0 }) },
    ],
  },
  {
    id: 'heel-raise',
    name: 'Heel raise',
    purpose: 'Rise onto the forefoot to load the calf, common after ankle injury and for gait push-off.',
    duration: 4,
    focus: 'ankle',
    region: 'Calf region',
    laterality: 'bi',
    limit: { min: -40, max: 10 },
    reps: 10,
    hold: 2,
    conditions: ['Fracture recovery', 'Arthritis', 'Stroke'],
    cues: 'Rise onto the balls of the feet, pause, lower slowly.',
    keyframes: [
      { time: 0, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: 0 }) },
      { time: 2, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: -32 }) },
      { time: 4, angles: pose({ hipFlexion: 4, kneeFlexion: 6, ankleFlexion: 0 }) },
    ],
  },
]

export const CONDITION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Stroke', label: 'Stroke' },
  { id: 'Parkinson’s', label: 'Parkinson’s' },
  { id: 'Frozen shoulder', label: 'Frozen shoulder' },
  { id: 'Rotator cuff', label: 'Rotator cuff' },
  { id: 'Fracture recovery', label: 'Fracture / post-op' },
  { id: 'Tendinopathy', label: 'Tendon pain' },
  { id: 'Arthritis', label: 'Arthritis' },
] as const

export function focusKey(focusOrExercise: ExerciseFocus | Pick<Exercise, 'focus' | 'keyframes'>): keyof JointAngles {
  if (typeof focusOrExercise === 'string') {
    return FOCUS_KEYS[focusOrExercise][0]
  }
  const keys = FOCUS_KEYS[focusOrExercise.focus]
  let best = keys[0]
  let bestSpan = -1
  for (const key of keys) {
    const values = focusOrExercise.keyframes.map((frame) => frame.angles[key] ?? 0)
    const span = Math.max(...values) - Math.min(...values)
    if (span > bestSpan) {
      bestSpan = span
      best = key
    }
  }
  return best
}

export function muscleHighlight(exercise: Pick<Exercise, 'id' | 'focus'>): RegionHighlight {
  if (exercise.focus === 'elbow') return 'biceps'
  if (exercise.focus === 'shoulder') return 'deltoid'
  if (exercise.focus === 'wrist') return 'forearm'
  if (exercise.focus === 'hip') return /abduct/.test(exercise.id) ? 'hip' : 'quad'
  if (exercise.focus === 'knee') return /curl|hamstring/.test(exercise.id) ? 'hamstring' : 'quad'
  return 'calf'
}

export function regionFor(focus: ExerciseFocus) {
  if (focus === 'elbow') return 'Biceps region'
  if (focus === 'shoulder') return 'Deltoid region'
  if (focus === 'wrist') return 'Forearm flexor region'
  if (focus === 'hip') return 'Hip flexor region'
  if (focus === 'knee') return 'Quadriceps region'
  return 'Calf / ankle region'
}

export function legDriveFor(exercise: Pick<Exercise, 'focus' | 'laterality'>): 'side' | 'both' {
  if (!isLegFocus(exercise.focus)) return 'both'
  return exercise.laterality === 'bi' ? 'both' : 'side'
}

export function sampleExercise(exercise: Exercise, time: number): JointAngles {
  const duration = Math.max(0.001, exercise.duration)
  const u = ((time % duration) + duration) % duration
  const frames = exercise.keyframes
  if (frames.length === 0) return { ...REST_ANGLES }
  if (frames.length === 1) return { ...frames[0].angles }
  let i = 0
  while (i < frames.length - 2 && frames[i + 1].time <= u) i += 1
  const a = frames[i]
  const b = frames[i + 1]
  const span = b.time - a.time
  const t = span <= 0 ? 0 : ease((u - a.time) / span)
  return lerpAngles(a.angles, b.angles, t)
}

export function sampleFrames(frames: JointAngles[], duration: number, time: number) {
  if (frames.length === 0) return { ...REST_ANGLES }
  if (frames.length === 1) return { ...frames[0] }
  const span = Math.max(0.001, duration)
  const u = ((time % span) + span) % span
  const cursor = (u / span) * (frames.length - 1)
  const index = Math.floor(cursor)
  const next = Math.min(frames.length - 1, index + 1)
  return lerpAngles(frames[index], frames[next], cursor - index)
}

export function peakFocus(exercise: Exercise) {
  const key = focusKey(exercise)
  const values = exercise.keyframes.map((frame) => frame.angles[key] ?? 0)
  const start = values[0] ?? 0
  return values.reduce(
    (best, value) => (Math.abs(value - start) > Math.abs(best - start) ? value : best),
    start,
  )
}

export type PatientOpts = {
  lag: number
  noise: number
  compensation: number
}

export function samplePatient(exercise: Exercise, time: number, opts: PatientOpts): JointAngles {
  const ideal = sampleExercise(exercise, Math.max(0, time - opts.lag))
  const n1 = Math.sin(time * 23.7)
  const n2 = Math.sin(time * 41.3 + 1.2)
  const noise = opts.noise * (0.65 * n1 + 0.35 * n2)
  const cheat = opts.compensation * (0.5 - 0.5 * Math.cos((time * Math.PI) / 2))
  if (exercise.focus === 'elbow') {
    return {
      ...ideal,
      elbowFlexion: ideal.elbowFlexion + noise,
      shoulderFlexion: ideal.shoulderFlexion + cheat,
      wristFlexion: ideal.wristFlexion + noise * 0.25,
    }
  }
  if (exercise.focus === 'shoulder') {
    return {
      ...ideal,
      shoulderAbduction: ideal.shoulderAbduction + noise,
      shoulderFlexion: ideal.shoulderFlexion + noise * 0.4,
      elbowFlexion: ideal.elbowFlexion + cheat * 0.6,
    }
  }
  if (exercise.focus === 'hip') {
    return {
      ...ideal,
      hipFlexion: ideal.hipFlexion + noise,
      hipAbduction: ideal.hipAbduction + noise * 0.3,
      kneeFlexion: ideal.kneeFlexion + cheat * 0.5,
    }
  }
  if (exercise.focus === 'knee') {
    return {
      ...ideal,
      kneeFlexion: ideal.kneeFlexion + noise,
      hipFlexion: ideal.hipFlexion + cheat * 0.45,
    }
  }
  if (exercise.focus === 'ankle') {
    return {
      ...ideal,
      ankleFlexion: ideal.ankleFlexion + noise,
      kneeFlexion: ideal.kneeFlexion + cheat * 0.25,
    }
  }
  return {
    ...ideal,
    wristFlexion: ideal.wristFlexion + noise,
    elbowFlexion: ideal.elbowFlexion + cheat * 0.45,
  }
}

/** Smooth reach loop used by the trail / heatmap page. */
export function reachAngles(time: number): JointAngles {
  const u = ((time % 5) + 5) % 5 / 5
  const s = 0.5 - 0.5 * Math.cos(u * Math.PI * 2)
  const side = Math.sin(u * Math.PI * 2)
  return {
    ...REST_ANGLES,
    shoulderFlexion: 18 + 58 * s,
    shoulderAbduction: 16 + 14 * side,
    elbowFlexion: 18 + 48 * (1 - s),
    wristFlexion: 8 * side,
  }
}

export function scaleFocus(angles: JointAngles, exercise: Exercise, scale: number, extraShoulder: number): JointAngles {
  const key = focusKey(exercise)
  const start = exercise.keyframes[0]?.angles[key] ?? 0
  const next = { ...angles }
  next[key] = start + ((angles[key] ?? 0) - start) * scale
  if (exercise.focus === 'shoulder') next.elbowFlexion += extraShoulder * 0.4
  else if (exercise.focus === 'hip' || exercise.focus === 'knee' || exercise.focus === 'ankle') {
    next.hipFlexion += extraShoulder * 0.2
  } else next.shoulderFlexion += extraShoulder
  return next
}
