import { useMemo } from 'react'
import { EXERCISES } from '../motion/exercises.ts'
import type { Exercise } from '../motion/types.ts'
import { SEED_PATIENTS, type PatientRecord } from './patients.ts'
import { useRehab } from '../store/rehabStore.ts'

export type { PatientRecord }
export { SEED_PATIENTS }

export type LibraryItem = {
  id: string
  purpose: string
  reps: number
  hold: number
  minutes: number
  tracked: string[]
  conditions: string[]
  cues?: string
}

export const ROM_WEEKS = [61, 70, 77, 83, 88]
export const FORM_WEEKS = [71, 78, 84, 91]
export const BASELINE_ROM = 61
export const WEEK_GOAL = 5
export const PRESCRIBED_SESSIONS = 20
export const COMPLETED_SESSIONS = 18

export const PATIENTS = SEED_PATIENTS

export function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function extraList(extras: Exercise | Exercise[] | null | undefined) {
  if (!extras) return [] as Exercise[]
  return Array.isArray(extras) ? extras.filter(Boolean) : [extras]
}

export function findExercise(id: string, extras?: Exercise | Exercise[] | null): Exercise | undefined {
  const extra = extraList(extras)
  const fromExtra = extra.find((item) => item.id === id || (id === 'custom' && item.id === 'custom'))
  if (fromExtra) return fromExtra
  return EXERCISES.find((item) => item.id === id)
}

export function libraryFor(exercise: Exercise): LibraryItem {
  const tracked =
    exercise.focus === 'wrist'
      ? ['Forearm', 'Hand']
      : exercise.focus === 'shoulder'
        ? ['Upper arm']
        : exercise.focus === 'hip'
          ? ['Thigh']
          : exercise.focus === 'knee'
            ? ['Thigh', 'Shank']
            : exercise.focus === 'ankle'
              ? ['Shank', 'Foot']
              : ['Upper arm', 'Forearm']
  return {
    id: exercise.id,
    purpose: exercise.purpose || 'A custom movement saved by a clinician.',
    reps: exercise.reps ?? 8,
    hold: exercise.hold ?? 2,
    minutes: Math.max(3, Math.round(exercise.duration)),
    tracked,
    conditions: exercise.conditions ?? [],
    cues: exercise.cues,
  }
}

export function allExercises(extras?: Exercise | Exercise[] | null) {
  const seen = new Map(EXERCISES.map((item) => [item.id, item]))
  for (const item of extraList(extras)) seen.set(item.id, item)
  return [...seen.values()]
}

export function useExerciseExtras() {
  const saved = useRehab((state) => state.savedExercises)
  const custom = useRehab((state) => state.customExercise)
  return useMemo(() => {
    const list = [...saved]
    if (custom && !list.some((item) => item.id === custom.id)) list.unshift(custom)
    return list
  }, [saved, custom])
}

export function useCatalog() {
  const extras = useExerciseExtras()
  return { extras, exercises: allExercises(extras) }
}

export function trendMessage(current: number, previous: number) {
  const delta = Math.round(current - previous)
  if (delta > 0) {
    return `Your maximum elbow range is ${delta}° higher than the previous session.`
  }
  if (delta < 0) {
    return `Today's peak range was ${Math.abs(delta)}° lower than the previous session.`
  }
  return 'Your peak range matched the previous session.'
}
