import { create } from 'zustand'
import type { Exercise, JointAngles, Side } from '../motion/types.ts'
import { SEED_PATIENTS, type PatientRecord } from '../product/patients.ts'
import { SEED_ASSESSMENTS } from '../trial/seed.ts'
import { historyForParticipant, toSessionRecord } from '../trial/sessionRecord.ts'
import { markBaselines } from '../trial/study.ts'
import type { AssessmentRecord, SessionRecord } from '../trial/types.ts'

export type { SessionRecord }

type Flag = 'showSkeleton' | 'showAxes' | 'showSensors'
export type ViewerMode = 'patient' | 'clinician'

type RehabState = {
  side: Side
  setSide: (side: Side) => void
  showSkeleton: boolean
  showAxes: boolean
  showSensors: boolean
  setFlag: (key: Flag, value: boolean) => void
  targetAngles: JointAngles
  hasCustomTarget: boolean
  saveTarget: (angles: JointAngles) => void
  clearTarget: () => void
  customExercise: Exercise | null
  setCustomExercise: (exercise: Exercise | null) => void
  savedExercises: Exercise[]
  upsertExercise: (exercise: Exercise) => void
  patients: PatientRecord[]
  addPatient: (input: { name: string; code?: string }) => string
  assignExerciseToPatient: (patientId: string, exerciseId: string) => void
  unassignExerciseFromPatient: (patientId: string, exerciseId: string) => void
  activePatientId: string
  setActivePatientId: (id: string) => void
  lastScore: number | null
  setLastScore: (score: number | null) => void
  viewerMode: ViewerMode
  setViewerMode: (mode: ViewerMode) => void
  activeExerciseId: string
  setActiveExerciseId: (id: string) => void
  history: SessionRecord[]
  addSession: (session: SessionRecord) => void
  assessments: AssessmentRecord[]
  addAssessment: (record: AssessmentRecord) => void
  weekDone: number
}

const STORAGE_KEY = 'motion-clinic-v2'

function loadClinic(): Partial<RehabState> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('motion-clinic-v1')
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<RehabState>
    return {
      patients: Array.isArray(parsed.patients) && parsed.patients.length ? parsed.patients : undefined,
      savedExercises: Array.isArray(parsed.savedExercises) ? parsed.savedExercises : undefined,
      customExercise: parsed.customExercise ?? undefined,
      activePatientId: parsed.activePatientId ?? undefined,
      assessments: Array.isArray(parsed.assessments) && parsed.assessments.length ? parsed.assessments : undefined,
    }
  } catch {
    return {}
  }
}

function persistClinic(state: RehabState) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      patients: state.patients,
      savedExercises: state.savedExercises,
      customExercise: state.customExercise,
      activePatientId: state.activePatientId,
      assessments: state.assessments,
    }),
  )
}

export const DEFAULT_TARGET: JointAngles = {
  shoulderFlexion: 12,
  shoulderAbduction: 12,
  elbowFlexion: 90,
  wristFlexion: 0,
  hipFlexion: 0,
  hipAbduction: 0,
  kneeFlexion: 5,
  ankleFlexion: 0,
}

const clinic = loadClinic()
const seedAssessments = clinic.assessments ?? SEED_ASSESSMENTS
const seedPatientId = clinic.activePatientId ?? '0142'

export const useRehab = create<RehabState>((set) => ({
  side: 'right',
  setSide: (side) => set({ side }),
  showSkeleton: false,
  showAxes: false,
  showSensors: false,
  setFlag: (key, value) => set({ [key]: value }),
  targetAngles: { ...DEFAULT_TARGET },
  hasCustomTarget: false,
  saveTarget: (angles) => set({ targetAngles: { ...angles }, hasCustomTarget: true }),
  clearTarget: () => set({ targetAngles: { ...DEFAULT_TARGET }, hasCustomTarget: false }),
  customExercise: clinic.customExercise ?? null,
  setCustomExercise: (customExercise) => set({ customExercise }),
  savedExercises: clinic.savedExercises ?? [],
  upsertExercise: (exercise) =>
    set((state) => {
      const exists = state.savedExercises.some((item) => item.id === exercise.id)
      return {
        customExercise: exercise,
        savedExercises: exists
          ? state.savedExercises.map((item) => (item.id === exercise.id ? exercise : item))
          : [...state.savedExercises, exercise],
      }
    }),
  patients: mergePatients(clinic.patients),
  addPatient: ({ name, code }) => {
    const trimmed = name.trim()
    if (!trimmed) return ''
    let created = ''
    set((state) => {
      const n = state.patients.length + 1
      const id = String(1000 + n).padStart(4, '0')
      created = id
      const record: PatientRecord = {
        id,
        code: (code?.trim() || `R-${id}`).toUpperCase(),
        name: trimmed,
        adherence: 0,
        sessions: 0,
        baseline: 60,
        current: 60,
        formFrom: 70,
        formTo: 70,
        last: 'Not started',
        completeness: 100,
        attention: null,
        assignedExerciseIds: [],
      }
      return { patients: [...state.patients, record] }
    })
    return created
  },
  assignExerciseToPatient: (patientId, exerciseId) =>
    set((state) => ({
      patients: state.patients.map((patient) =>
        patient.id === patientId && !patient.assignedExerciseIds.includes(exerciseId)
          ? { ...patient, assignedExerciseIds: [...patient.assignedExerciseIds, exerciseId] }
          : patient,
      ),
    })),
  unassignExerciseFromPatient: (patientId, exerciseId) =>
    set((state) => ({
      patients: state.patients.map((patient) =>
        patient.id === patientId
          ? { ...patient, assignedExerciseIds: patient.assignedExerciseIds.filter((id) => id !== exerciseId) }
          : patient,
      ),
    })),
  activePatientId: seedPatientId,
  setActivePatientId: (activePatientId) =>
    set((state) => ({
      activePatientId,
      history: historyForParticipant(state.assessments, activePatientId),
    })),
  lastScore: 91,
  setLastScore: (lastScore) => set({ lastScore }),
  viewerMode: 'patient',
  setViewerMode: (viewerMode) => set({ viewerMode }),
  activeExerciseId: 'elbow-flexion',
  setActiveExerciseId: (activeExerciseId) => set({ activeExerciseId }),
  history: historyForParticipant(seedAssessments, seedPatientId),
  addSession: (session) =>
    set((state) => ({
      history: [session, ...state.history],
      lastScore: session.score,
      weekDone: Math.min(5, state.weekDone + 1),
    })),
  assessments: seedAssessments,
  addAssessment: (incoming) =>
    set((state) => {
      const withFlag = markBaselines([incoming, ...state.assessments])
      const record = withFlag.find((item) => item.id === incoming.id) ?? incoming
      const patients = state.patients.map((patient) =>
        patient.id === record.participantId ? applyAssessmentToPatient(patient, record) : patient,
      )
      return {
        assessments: withFlag,
        patients,
        history: historyForParticipant(withFlag, state.activePatientId),
        lastScore: record.formScore,
        weekDone: Math.min(5, state.weekDone + 1),
      }
    }),
  weekDone: 4,
}))

useRehab.subscribe((state) => persistClinic(state))

function mergePatients(stored?: PatientRecord[]) {
  const seed = SEED_PATIENTS.map((patient) => ({ ...patient, assignedExerciseIds: [...patient.assignedExerciseIds] }))
  if (!stored?.length) return seed
  const seen = new Set(stored.map((patient) => patient.id))
  return [...stored.map((patient) => ({ ...patient, assignedExerciseIds: [...patient.assignedExerciseIds] })), ...seed.filter((patient) => !seen.has(patient.id))]
}

function applyAssessmentToPatient(patient: PatientRecord, record: AssessmentRecord): PatientRecord {
  return {
    ...patient,
    sessions: patient.sessions + 1,
    last: toSessionRecord(record).date,
    current: record.qc.status === 'valid' ? Math.round(record.endpoints.maxRom) : patient.current,
    baseline: record.baseline ? Math.round(record.endpoints.maxRom) : patient.baseline,
    completeness: record.qc.qualityScore,
    formTo: record.formScore,
    attention: record.qc.status === 'review' || record.qc.status === 'invalid' ? record.qc.reviewReasons[0] ?? patient.attention : patient.attention,
  }
}
