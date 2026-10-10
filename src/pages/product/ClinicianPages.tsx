import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { peakFocus } from '../../motion/exercises.ts'
import { allExercises, libraryFor, useExerciseExtras } from '../../product/catalog.ts'
import { useRehab } from '../../store/rehabStore.ts'
import { compareToBaseline, studyOverview } from '../../trial/study.ts'
import { HeadingInfo } from '../../ui/InfoTip.tsx'

export function ClinicianHome() {
  const setViewerMode = useRehab((state) => state.setViewerMode)
  const patients = useRehab((state) => state.patients)
  const assessments = useRehab((state) => state.assessments)
  const addPatient = useRehab((state) => state.addPatient)
  const extras = useExerciseExtras()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  useEffect(() => { setViewerMode('clinician') }, [setViewerMode])
  const active = patients.filter((patient) => patient.sessions > 0).length
  const study = studyOverview(assessments, patients.length)

  function submit(event: FormEvent) {
    event.preventDefault()
    const id = addPatient({ name, code })
    if (!id) return
    setName('')
    setCode('')
    setAdding(false)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Clinician</p>
          <h1>Patient overview</h1>
        </div>
        <div className="row">
          <button type="button" className="ghost-btn" onClick={() => setAdding((value) => !value)}>
            Add patient
          </button>
          <Link to="/study" className="ghost-btn">Study overview</Link>
          <Link to="/clinician/builder" className="candy">Exercise builder</Link>
        </div>
      </header>
      {adding ? (
        <form className="sticker prompt-bubble" onSubmit={submit}>
          <p className="kicker">New participant</p>
          <h2>Add a patient</h2>
          <label className="field">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required />
          </label>
          <label className="field">
            Optional code
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="R-0301" />
          </label>
          <div className="row">
            <button type="submit" className="candy" disabled={!name.trim()}>Save patient</button>
            <button type="button" className="ghost-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
      <section className="card-grid">
        {patients.map((patient) => {
          const assigned = patient.assignedExerciseIds
            .map((id) => allExercises(extras).find((item) => item.id === id))
            .filter(Boolean)
          return (
            <Link key={patient.id} to={`/clinician/patient/${patient.id}`} className="sticker exercise-card">
              <span className="pill violet">{patient.code}</span>
              <h2>{patient.name}</h2>
              <p>Adherence {patient.adherence}%</p>
              <p className="quiet">Elbow range {patient.baseline}° → {patient.current}°</p>
              <p className="quiet">
                {assigned.length
                  ? `Assigned: ${assigned.map((item) => item!.name).join(', ')}`
                  : 'No exercises assigned yet'}
              </p>
            </Link>
          )
        })}
      </section>
      <section className="sticker">
        <HeadingInfo title="Caseload" label="Study overview">
          <p>Remote motor study snapshot from stored assessments. Valid / review / invalid are MotionQC labels, not clinical diagnoses.</p>
        </HeadingInfo>
        <div className="stat-row"><span>Participants</span><strong>{study.participants}</strong></div>
        <div className="stat-row"><span>Active</span><strong>{active}</strong></div>
        <div className="stat-row"><span>Sessions</span><strong>{study.completed}</strong></div>
        <div className="stat-row"><span>Adherence</span><strong>{study.adherence}%</strong></div>
        <div className="stat-row"><span>Valid / review / invalid</span><strong>{study.valid} / {study.review} / {study.invalid}</strong></div>
      </section>
    </div>
  )
}

export function PatientPage() {
  const setViewerMode = useRehab((state) => state.setViewerMode)
  const patients = useRehab((state) => state.patients)
  const assessments = useRehab((state) => state.assessments)
  const assignExerciseToPatient = useRehab((state) => state.assignExerciseToPatient)
  const unassignExerciseFromPatient = useRehab((state) => state.unassignExerciseFromPatient)
  const extras = useExerciseExtras()
  const [pick, setPick] = useState('')
  useEffect(() => { setViewerMode('clinician') }, [setViewerMode])
  const { id = '' } = useParams()
  const patient = patients.find((item) => item.id === id) ?? patients[0]
  if (!patient) {
    return (
      <div className="page">
        <h1>No patients yet</h1>
        <Link to="/clinician" className="candy">Add a patient</Link>
      </div>
    )
  }
  const library = allExercises(extras)
  const assigned = patient.assignedExerciseIds
    .map((exerciseId) => library.find((item) => item.id === exerciseId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const available = library.filter((item) => !patient.assignedExerciseIds.includes(item.id))
  const compared = compareToBaseline(assessments, patient.id)
  const delta = compared ? compared.change.rom : patient.current - patient.baseline

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Participant {patient.code}</p>
          <h1>{patient.name}</h1>
        </div>
        <div className="row">
          <Link to={`/study/participant/${patient.id}`} className="candy">Research view</Link>
          <Link to="/clinician" className="ghost-btn">All patients</Link>
        </div>
      </header>
      <section className="pair">
        <article className="sticker">
          <div className="stat-row"><span>Adherence</span><strong>{patient.adherence}%</strong></div>
          <div className="stat-row"><span>Sessions</span><strong>{patient.sessions} / 20</strong></div>
          <div className="stat-row"><span>Last session</span><strong>{patient.last}</strong></div>
          <div className="stat-row"><span>Data completeness</span><strong>{patient.completeness}%</strong></div>
        </article>
        <article className="sticker">
          <h2>Elbow range</h2>
          <p className="count" style={{ fontSize: 56 }}>
            {compared ? `${compared.baseline.endpoints.maxRom.toFixed(0)}° → ${compared.current.endpoints.maxRom.toFixed(0)}°` : `${patient.baseline}° → ${patient.current}°`}
          </p>
          <p style={{ fontWeight: 800 }}>{delta >= 0 ? '+' : ''}{Number(delta).toFixed(1)}°</p>
          <div className="stat-row"><span>Smoothness</span><strong>{compared ? `${compared.baseline.endpoints.smoothness.toFixed(2)} → ${compared.current.endpoints.smoothness.toFixed(2)}` : `${patient.formFrom} → ${patient.formTo}`}</strong></div>
          <div className="stat-row"><span>Compensation</span><strong>{compared ? `${compared.baseline.endpoints.compensationAngle.toFixed(1)}° → ${compared.current.endpoints.compensationAngle.toFixed(1)}°` : '—'}</strong></div>
        </article>
      </section>
      <section className="sticker">
        <p className="kicker">Plan</p>
        <h2>Assigned exercises</h2>
        <p className="quiet">These are the movements this patient should practice. You can add from the library or generate a new one in the builder.</p>
        {assigned.length ? (
          <div className="card-grid" style={{ marginTop: 14 }}>
            {assigned.map((exercise) => {
              const info = libraryFor(exercise)
              return (
                <article key={exercise.id} className="sticker exercise-card">
                  <span className="pill mint">{exercise.focus}</span>
                  <h3>{exercise.name}</h3>
                  <p>{info.reps} reps · target {Math.round(peakFocus(exercise))}°</p>
                  <p className="quiet">{info.purpose}</p>
                  <div className="row" style={{ marginTop: 'auto' }}>
                    <Link to={`/exercises/${exercise.id}`} className="ghost-btn">Preview</Link>
                    <button type="button" className="ghost-btn" onClick={() => unassignExerciseFromPatient(patient.id, exercise.id)}>Remove</button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p style={{ marginTop: 10 }}>Nothing assigned yet.</p>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <label className="field" style={{ flex: 1, minWidth: 200 }}>
            Add from library
            <select value={pick} onChange={(event) => setPick(event.target.value)}>
              <option value="">{available.length ? 'Choose an exercise' : 'All library items are assigned'}</option>
              {available.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="candy"
            disabled={!pick}
            onClick={() => {
              assignExerciseToPatient(patient.id, pick)
              setPick('')
            }}
          >
            Assign
          </button>
          <Link to={`/clinician/builder?patient=${patient.id}`} className="ghost-btn">Generate new</Link>
        </div>
      </section>
      {patient.attention ? (
        <section className="attention">
          <p className="kicker">Attention</p>
          <h2>Recorded movement change</h2>
          <p>{patient.attention}</p>
          <p className="quiet">This is a movement metric from the session, not a diagnosis.</p>
          <Link to={`/study/participant/${patient.id}`} className="ghost-btn">Open research view</Link>
        </section>
      ) : null}
    </div>
  )
}
