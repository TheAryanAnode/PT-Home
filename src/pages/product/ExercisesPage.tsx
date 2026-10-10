import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONDITION_FILTERS, peakFocus } from '../../motion/exercises.ts'
import { libraryFor, useCatalog } from '../../product/catalog.ts'
import { useRehab } from '../../store/rehabStore.ts'
import { InfoTip } from '../../ui/InfoTip.tsx'

export function ExercisesPage() {
  const { exercises } = useCatalog()
  const mode = useRehab((state) => state.viewerMode)
  const activePatientId = useRehab((state) => state.activePatientId)
  const patients = useRehab((state) => state.patients)
  const assignedIds = patients.find((patient) => patient.id === activePatientId)?.assignedExerciseIds ?? []
  const [filter, setFilter] = useState<string>('all')

  const ordered = useMemo(() => {
    const list = [...exercises].sort((a, b) => {
      const aOn = assignedIds.includes(a.id) ? 1 : 0
      const bOn = assignedIds.includes(b.id) ? 1 : 0
      return bOn - aOn
    })
    if (filter === 'all') return list
    return list.filter((exercise) => (exercise.conditions ?? []).includes(filter))
  }, [assignedIds, exercises, filter])

  return (
    <div className="page">
      <header>
        <div className="heading-row">
          <p className="kicker">Exercises</p>
          <InfoTip label="Who these are for">
              <p>Demos cover arm and leg rehab after stroke, Parkinson’s, frozen shoulder, rotator-cuff work, tendon pain, arthritis, and fracture or post-op recovery. Motion is a practice guide, not a diagnosis or a substitute for a clinician.</p>
          </InfoTip>
        </div>
        <h1>{mode === 'clinician' ? 'Library' : 'Practice library'}</h1>
        <p className="lede">
          {mode === 'clinician'
            ? 'Assign from a patient page, or generate a new movement in the builder.'
            : 'Assigned items are listed first. Preview the motion, then start when the sensors are on.'}
        </p>
      </header>
      <div className="filters" role="tablist" aria-label="Condition">
        {CONDITION_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'on' : ''}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="card-grid">
        {ordered.map((exercise) => {
          const info = libraryFor(exercise)
          const assigned = assignedIds.includes(exercise.id)
          const target = Math.round(Math.abs(peakFocus(exercise)))
          return (
            <article key={exercise.id} className={`sticker exercise-card${assigned ? ' featured' : ''}`}>
              <div className="heading-row">
                <span className={`pill${assigned ? ' mint' : ''}`}>{assigned ? 'Assigned' : exercise.focus}</span>
                <InfoTip label={exercise.name}>
                  <p>{info.purpose}</p>
                  {info.cues ? <p>{info.cues}</p> : null}
                  <p className="quiet">Tracked: {info.tracked.join(', ')}. Target {target}° · {info.hold}s hold.</p>
                </InfoTip>
              </div>
              <h2>{exercise.name}</h2>
              <p>{info.reps} reps · {target}°</p>
              <div className="condition-pills">
                {info.conditions.slice(0, 2).map((condition) => (
                  <span key={condition} className="pill">{condition}</span>
                ))}
              </div>
              <div className="row" style={{ marginTop: 'auto' }}>
                <Link to={`/exercises/${exercise.id}`} className="ghost-btn">Preview</Link>
                <Link to={`/session/setup?exercise=${exercise.id}`} className="candy">Start</Link>
              </div>
            </article>
          )
        })}
      </div>
      {ordered.length === 0 ? <p className="quiet">Nothing in this filter yet.</p> : null}
    </div>
  )
}
